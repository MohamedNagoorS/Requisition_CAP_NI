sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History"
],
    function (Controller, UIComponent, History) {
        "use strict";

        return Controller.extend("com.procurement.ui.controller.AdminServices", {
            onInit: function () {
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

            onPressManager: function () {
                var oRouter = UIComponent.getRouterFor(this);
                // Correct route name is RouteManagerApprovals
                oRouter.navTo("RouteManagerApprovals");
            },

            onPressAdmin: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteAdmin");
            }
        });
    }
);
