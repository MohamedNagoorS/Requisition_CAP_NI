sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, UIComponent, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("com.procurement.ui.controller.Manager", {
        onInit: function () {
            console.log("Manager Controller Loaded");
        },

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

        fmtStatus: function (sStatus) {
            console.log("fmtStatus called with:", sStatus);
            if (!sStatus) return true;
            var sClean = sStatus.toString().trim().toLowerCase();
            return sClean !== "accepted" && sClean !== "rejected";
        },

        _updateStatus: function (oContext, sStatus) {
            oContext.setProperty("status", sStatus);
            MessageToast.show("Requisition " + sStatus);
        }
    });
});