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
        formatApprovalActionVisibility: function (sStatus) {
            // Debug log to verify exact value received
            console.log("Formatting visibility for status: '" + sStatus + "'");

            if (!sStatus) {
                return true; // Use default behavior (e.g. show) or false if you prefer
            }

            // Robust check: Trim whitespace and ignore case
            var sClean = sStatus.trim().toLowerCase();

            // Logic: Hide if Accepted or Rejected
            if (sClean === "accepted" || sClean === "rejected") {
                return false;
            }

            return true;
        },
        _updateStatus: function (oContext, sStatus) {
            // When this property updates, the XML Expression Binding will instantly re-evaluate 
            // and hide the buttons because status is no longer 'Pending Approval'
            oContext.setProperty("status", sStatus);
            MessageToast.show("Requisition " + sStatus);

            // Note: In a real app connected to a backend, you might need:
            // oContext.getModel().submitChanges();
        }
    });
});