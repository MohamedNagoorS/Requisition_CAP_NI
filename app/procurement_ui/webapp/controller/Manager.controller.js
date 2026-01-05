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
        isButtonVisible: function (sStatus) {
            // Safety check: if status is empty, show buttons
            if (!sStatus) return true;
            
            // Clean up the string and check values
            var sCleanStatus = sStatus.trim(); 
            return sCleanStatus !== "Accepted" && sCleanStatus !== "Rejected";
        },

        // DELETED: isActionVisible is no longer needed.
debugButtonVisibility: function (sStatus) {
            // 1. Log the exact value to the Console
            console.log("DEBUG: Row Status is ['" + sStatus + "']");

            // 2. Handle null/undefined (show buttons by default if status is missing)
            if (!sStatus) return true;

            // 3. Check for specific values
            if (sStatus === "Accepted" || sStatus === "Rejected") {
                return false; // HIDE buttons
            }
            return true; // SHOW buttons
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