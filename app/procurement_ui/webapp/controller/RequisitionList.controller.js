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
        },

        _onObjectMatched: function () {
            // Refresh the table binding to fetch latest data from DB
            var oTable = this.byId("requisitionTable");
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
        }
    });
});
