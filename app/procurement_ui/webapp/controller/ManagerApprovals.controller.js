sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, UIComponent, History, MessageBox, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("com.procurement.ui.controller.ManagerApprovals", {
        onInit: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteManagerApprovals").attachPatternMatched(this._onObjectMatched, this);

            var oViewModel = new JSONModel({
                currencyCode: "USD"
            });
            this.getView().setModel(oViewModel, "view");
        },

        _onObjectMatched: function () {
            // Refresh the table binding to fetch latest data from DB
            var oTable = this.byId("approvalTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
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

        onApprove: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            this._updateStatus(oContext, "Approved");
        },

        onReject: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            this._updateStatus(oContext, "Rejected");
        },

        _updateStatus: function (oContext, sStatus) {
            var sID = oContext.getProperty("requisitionHeaderID");

            MessageBox.confirm("Are you sure you want to set status to " + sStatus + "?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oContext.setProperty("status", sStatus);
                        // Submit batch if needed, but context.setProperty typically updates 
                        // local binding and if auto-group is used, it flushes.
                        // For safety, request refesh or submit.

                        // We rely on the model to handle the patch.
                        // If it fails, we should handle error.
                        // Assuming V4 model with Update Group 'auto' or 'direct'.

                        // Wait for potential sync
                        oContext.getModel().submitBatch("auto").then(function () {
                            MessageToast.show("Requisition " + sID + " has been " + sStatus + ".");
                        }).catch(function (err) {
                            MessageBox.error("Error updating status: " + err.message);
                        });
                    }
                }
            });
        }
    });
});
