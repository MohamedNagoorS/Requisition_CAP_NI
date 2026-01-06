sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "com/procurement/ui/model/formatter"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, UIComponent, JSONModel, History, MessageToast, MessageBox, formatter) {
        "use strict";

        return Controller.extend("com.procurement.ui.controller.PRDetails", {
            formatter: formatter,

            onInit: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.getRoute("RoutePRDetails").attachPatternMatched(this._onObjectMatched, this);

                var oViewModel = new JSONModel({
                    currencyCode: "USD"
                });
                this.getView().setModel(oViewModel, "view");
            },

            _onObjectMatched: function (oEvent) {
                var sRequisitionId = oEvent.getParameter("arguments").requisitionId;
                var sID = sRequisitionId.includes("'") ? sRequisitionId : "'" + sRequisitionId + "'";
                var sPath = "/RequisitionHeader(ID=" + sID + ",IsActiveEntity=true)";

                this.getView().bindElement({
                    path: sPath,
                    parameters: {
                        $expand: "items"
                    },
                    events: {
                        dataReceived: this._updateActionState.bind(this),
                        change: this._updateActionState.bind(this)
                    }
                });
            },

            _updateActionState: function () {
                var oContext = this.getView().getBindingContext();
                if (!oContext) return;

                oContext.requestObject().then(function (oReq) {
                    var oViewModel = this.getView().getModel("view");

                    // Default State: Disabled
                    oViewModel.setProperty("/isGPOEnabled", false);
                    oViewModel.setProperty("/isGIEnabled", false);

                    if (oReq.status === "Rejected" || oReq.status === "Created" || oReq.status === "Pending Approval") {
                        // Keep disabled
                        return;
                    }

                    if (oReq.status === "Approved") {
                        // Check Warehouse
                        var oModel = this.getOwnerComponent().getModel();
                        var oBindList = oModel.bindList("/Warehouse");

                        oBindList.requestContexts().then(function (aWarehouseContexts) {
                            var aWarehouseItems = aWarehouseContexts.map(ctx => ctx.getObject());
                            var aReqItems = oReq.items || [];
                            var bAllInStock = true;

                            if (aReqItems.length === 0) bAllInStock = false;

                            aReqItems.forEach(function (reqItem) {
                                var oStock = aWarehouseItems.find(w => w.productName === reqItem.materialName);
                                if (!oStock || oStock.quantity < reqItem.quantity) {
                                    bAllInStock = false;
                                }
                            });

                            if (bAllInStock) {
                                oViewModel.setProperty("/isGIEnabled", true);
                            } else {
                                oViewModel.setProperty("/isGPOEnabled", true);
                            }
                        }.bind(this));
                    }
                }.bind(this));
            },

            onGeneratePO: function () {
                MessageToast.show("Generate Purchase Order: Under Construction");
            },

            onGoodsIssue: function () {
                MessageToast.show("Goods Issue -> Warehouse: Under Construction");
            },

            onNavBack: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteHome", {}, true);
            },

            onSendForApproval: function () {
                // Update the status to 'Pending Approval'
                var oContext = this.getView().getBindingContext();

                oContext.setProperty("status", "Pending Approval");

                // Submit changes
                // In OData V4, setProperty updates locally. We rely on model's auto or manual submit.
                // Assuming auto-submit or grouped.
                // If operationMode is Server (default), it creates a PATCH request.

                // Note: The correct way in V4 might be context.requestProperty or just updating and catch errors.
                // However, setProperty on a bound context triggers PATCH if the property is part of the binding.

                this.getView().getModel().submitBatch("auto").then(function () { // If batch group is auto, it might be already sent.
                    MessageBox.success("Requisition Sent for Approval!");
                }.bind(this)).catch(function (err) {
                    MessageBox.error("Error updating status: " + err.message);
                });

                // Force a refresh or simply manually handle message if auto-sync
                if (this.getView().getModel().hasPendingChanges()) {
                    this.getView().getModel().submitBatch("updateGroup");
                } else {
                    MessageBox.success("Requisition Sent for Approval!");
                }
            }
        });
    }
);
