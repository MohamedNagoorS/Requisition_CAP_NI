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
            oContext.setProperty("status", "Approved");
            this.getView().getModel().submitBatch("auto");
            MessageToast.show("Requisition Approved.");
        },

        onReject: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            oContext.setProperty("status", "Rejected");
            this.getView().getModel().submitBatch("auto");
            MessageToast.show("Requisition Rejected.");
        }
    });
});
