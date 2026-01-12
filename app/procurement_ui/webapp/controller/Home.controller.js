sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, UIComponent) {
        "use strict";

        return Controller.extend("com.procurement.ui.controller.Home", {
            onInit: function () {

            },

            onPressCreateRequest: function () {
                var oRouter = UIComponent.getRouterFor(this);
                // Navigate to the "Unified" Create Request view
                oRouter.navTo("RouteManualPR");
            },

            onPressHistory: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteRequisitionList");
            },

            onPressManager: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteManagerApprovals");
            },

            onPressAdmin: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteAdmin");
            }
        });
    }
);
