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

                    // Reset States
                    oViewModel.setProperty("/isGPOEnabled", false);
                    oViewModel.setProperty("/isGIEnabled", false);

                    if (oReq.status === "Approved") {
                        // Safe Default: Enable PO button immediately while we check stock
                        // This prevents buttons from appearing disabled if the call is slow/fails
                        oViewModel.setProperty("/isGPOEnabled", true);

                        // Check Warehouse Stock
                        var oModel = this.getOwnerComponent().getModel();
                        var oBindList = oModel.bindList("/Warehouse");

                        oBindList.requestContexts().then(function (aWarehouseContexts) {
                            var aWarehouseItems = aWarehouseContexts.map(ctx => ctx.getObject());
                            var aReqItems = oReq.items || [];
                            var bAllItemsInStock = true;

                            // If no items in requisition, logic is tricky. Let's assume out of stock.
                            if (aReqItems.length === 0) {
                                bAllItemsInStock = false;
                            } else {
                                // Iterate items to verify stock
                                aReqItems.forEach(function (reqItem) {
                                    var oStock = aWarehouseItems.find(w => w.productName === reqItem.materialName);
                                    // If item not found OR quantity insufficient -> OutOfStock
                                    if (!oStock || oStock.quantity < reqItem.quantity) {
                                        bAllItemsInStock = false;
                                    }
                                });
                            }

                            if (bAllItemsInStock && aReqItems.length > 0) {
                                // Specific Case: All items found and sufficient quantity
                                oViewModel.setProperty("/isGIEnabled", true);
                                oViewModel.setProperty("/isGPOEnabled", false);
                            } else {
                                // Default Case: Out of Stock or Missing Item
                                oViewModel.setProperty("/isGIEnabled", false);
                                oViewModel.setProperty("/isGPOEnabled", true);
                            }
                        }.bind(this)).catch(function (oError) {
                            console.error("Warehouse Check Failed", oError);
                            // Stick to safe default (GPO enabled)
                        });
                    }
                }.bind(this)).catch(function (err) {
                    console.error("Context request failed", err);
                });
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
