sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, UIComponent, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("com.procurement.ui.controller.Manager", {
        onInit: function () { },

        onNavBack: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("RouteHome");
        },

        onApprove: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            this._updateStatus(oContext, "Accepted");
        },

        onReject: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            this._updateStatus(oContext, "Rejected");
        },

        isActionVisible: function (sStatus) {
            return sStatus === "Pending Approval";
        },

        _updateStatus: function (oContext, sStatus) {
            // Keep your existing update logic
            oContext.setProperty("status", sStatus).then(function () {
                MessageToast.show("Requisition " + sStatus);
            }).catch(function (oError) {
                if (oError) {
                    MessageBox.error("Error updating status: " + oError.message);
                }
            });
        }
    });
});