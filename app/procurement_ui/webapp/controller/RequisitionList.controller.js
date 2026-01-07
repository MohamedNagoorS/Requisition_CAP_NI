sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "com/procurement/ui/model/formatter"
], function (Controller, UIComponent, History, MessageBox, MessageToast, formatter) {
    "use strict";

    return Controller.extend("com.procurement.ui.controller.RequisitionList", {
        formatter: formatter,

        onInit: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteRequisitionList").attachPatternMatched(this._onObjectMatched, this);

            // Model for UI state (stock status per requisition)
            this.getView().setModel(new sap.ui.model.json.JSONModel({ stockStatus: {} }), "ui");
        },

        _onObjectMatched: function () {
            var oTable = this.byId("requisitionTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
            this._checkStockAvailability();
        },

        onUpdateFinished: function () {
            this._checkStockAvailability();
        },

        _checkStockAvailability: function () {
            var oTable = this.byId("requisitionTable");
            var aItems = oTable.getItems();
            if (aItems.length === 0) return;

            // 1. Fetch Warehouse Data
            var oModel = this.getOwnerComponent().getModel();
            var oBindList = oModel.bindList("/Warehouse");

            oBindList.requestContexts().then(function (aWarehouseContexts) {
                var aWarehouseItems = aWarehouseContexts.map(ctx => ctx.getObject());

                aItems.forEach(function (oItem) {
                    var oContext = oItem.getBindingContext();
                    if (!oContext) return;

                    var oReq = oContext.getObject();

                    if (oReq.status === 'Approved') {
                        // We strictly only update for Approved items
                        oContext.requestObject().then(function (oFullReq) {
                            var bAllInStock = true;
                            var aReqItems = oFullReq.items || [];

                            if (aReqItems.length === 0) bAllInStock = false;

                            aReqItems.forEach(function (reqItem) {
                                // Check if item exists in Warehouse and has enough quantity
                                // Use material_ID (Foreign Key) to match Warehouse productID
                                var oStock = aWarehouseItems.find(w => w.productID === reqItem.material_ID);
                                if (!oStock || oStock.quantity < reqItem.quantity) {
                                    bAllInStock = false;
                                }
                            });

                            var sStatus = bAllInStock ? "InStock" : "OutOfStock";
                            var oUiModel = this.getView().getModel("ui");
                            // Set property for this specific Requisition ID
                            oUiModel.setProperty("/stockStatus/" + oReq.requisitionHeaderID, sStatus);
                        }.bind(this));
                    } else {
                        // Ensure cleaned up for non-approved (if status changed)
                        var oUiModel = this.getView().getModel("ui");
                        if (oUiModel) {
                            oUiModel.setProperty("/stockStatus/" + oReq.requisitionHeaderID, null);
                        }
                    }
                }.bind(this));

            }.bind(this));
        },

        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteHome", {}, true);
            }
        },

        onPressRequisition: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext();
            var sID = oContext.getProperty("ID"); // Get the UUID

            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("RoutePRDetails", {
                requisitionId: sID
            });
        },

        onEditRequisition: function (oEvent) {
            // Re-use logic to go to details, maybe passing a flag in future?
            // For now, same as press.
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext();
            var sID = oContext.getProperty("ID");

            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("RoutePRDetails", {
                requisitionId: sID
            });
        },

        onDeleteRequisition: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext();
            // var sRequisitionID = oContext.getProperty("requisitionHeaderID");

            MessageBox.confirm("Are you sure you want to delete this requisition?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oContext.delete().then(function () {
                            MessageToast.show("Requisition deleted successfully.");
                        }).catch(function (oError) {
                            MessageBox.error("Error deleting requisition: " + oError.message);
                        });
                    }
                }
            });
        },

        onGeneratePO: function () {
            MessageToast.show("Generate Purchase Order: Under Construction");
        },

        onGoodsIssue: function () {
            MessageToast.show("Goods Issue for Warehouse: Under Construction");
        },

        // Visibility Helpers
        isPOVisible: function (sStatus, sID, mStockStatus) {
            if (sStatus !== "Approved") return false;
            // If data isn't loaded yet, hide to be safe, or show if you want default behavior
            if (!mStockStatus || !sID) return false;
            return mStockStatus[sID] === "OutOfStock";
        },

        isGoodsIssueVisible: function (sStatus, sID, mStockStatus) {
            if (sStatus !== "Approved") return false;
            if (!mStockStatus || !sID) return false;
            return mStockStatus[sID] === "InStock";
        }
    });
});
