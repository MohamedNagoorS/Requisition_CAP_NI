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

            onPressCatalog: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteVendorSelection");
            },

            onPressManual: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteManualPR");
            }
        });
    }
);
