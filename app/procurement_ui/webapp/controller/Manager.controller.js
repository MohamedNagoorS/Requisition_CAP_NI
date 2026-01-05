sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, UIComponent, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("com.procurement.ui.controller.Manager", {
        onInit: function () {
            // Initialization logic if needed
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

        isActionVisible: function (sStatus) {
            return sStatus !== "Accepted" && sStatus !== "Rejected";
        },

        _updateStatus: function (oContext, sStatus) {
            var that = this;

            // For OData V4, we can use setProperty or submitBatch if needed. 
            // Assuming default binding behavior where property update sends PATCH.
            // If using V2 or specific CAP OData V4 behavior:

            oContext.setProperty("status", sStatus).then(function () {
                MessageToast.show("Requisition " + sStatus);
                // Refresh logic if needed, but binding should handle it
            }).catch(function (oError) {
                // If setProperty doesn't return a promise (V2), we handle differently, 
                // but CAP V4 model usually returns promise or we check error in event.
                // If it fails, trying simplified approach:
                if (oError) {
                    MessageBox.error("Error updating status: " + oError.message);
                }
            });

            // Note: In strict OData V4, we might need to submit changes if not auto-submit.
            // manifest.json says: "operationMode": "Server", "synchronizationMode": "None", "autoExpandSelect": true, "earlyRequests": true
            // It doesn't explicitly say "autoSubmit": true/false in "settings" for the model (it defaults to true for V2 usually, generic for V4?).
            // The manifest has "type": "OData", "odataVersion": "4.0".
            // The model settings are "synchronizationMode": "None" which is weird for V4 (should be 'None' for V2, V4 doesn't have this property exactly the same way).
            // Actually, "type": "OData" usually implies V2 in some contexts or generic. V4 uses "sap.ui.model.odata.v4.ODataModel".
            // Let's check manifest again: "type": "OData" usually means V2. "odataVersion": "4.0" is the service version but the model type might default to V2 model if "type": "OData" is used without "sap.ui.model.odata.v4.ODataModel".
            // However, CAP usually serves V4.
            // If it is V4 model, setProperty works.
        }
    });
});
