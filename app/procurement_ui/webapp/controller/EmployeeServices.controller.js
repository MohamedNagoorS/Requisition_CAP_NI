sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History"
],
    function (Controller, UIComponent, History) {
        "use strict";

        return Controller.extend("com.procurement.ui.controller.EmployeeServices", {
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

            onPressCreateRequest: function () {
                var oRouter = UIComponent.getRouterFor(this);
                // Navigate to the "Unified" Create Request view
                oRouter.navTo("RouteManualPR");
            },

            onPressHistory: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteRequisitionList");
            }
        });
    }
);
