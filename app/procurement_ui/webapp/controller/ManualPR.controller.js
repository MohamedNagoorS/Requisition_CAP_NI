sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, UIComponent, JSONModel, History, MessageToast) {
        "use strict";

        return Controller.extend("com.procurement.ui.controller.ManualPR", {
            onInit: function () {
                var oViewModel = new JSONModel({
                    currencyCode: "USD"
                });
                this.getView().setModel(oViewModel, "view");

                var oFormModel = new JSONModel({
                    materialName: "",
                    quantity: 1,
                    price: null,
                    costCenter: ""
                });
                this.getView().setModel(oFormModel, "form");
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

            onAddToRequest: function () {
                var oFormModel = this.getView().getModel("form");
                var oData = oFormModel.getData();

                if (!oData.materialName || !oData.quantity || !oData.price || !oData.costCenter) {
                    MessageToast.show("Please fill in all required fields.");
                    return;
                }

                var oCartModel = this.getOwnerComponent().getModel("cart");
                if (!oCartModel) {
                    oCartModel = new JSONModel({ items: [], total: 0 });
                    this.getOwnerComponent().setModel(oCartModel, "cart");
                }

                var aItems = oCartModel.getProperty("/items");

                aItems.push({
                    productId: "MANUAL-" + Date.now(),
                    productName: oData.materialName,
                    description: "Manual Entry",
                    price: parseFloat(oData.price),
                    quantity: parseInt(oData.quantity),
                    costCenter: oData.costCenter,
                    type: 'Manual'
                });

                oCartModel.setProperty("/items", aItems);
                MessageToast.show("Added manual item to request.");

                // Reset form
                oFormModel.setData({
                    materialName: "",
                    quantity: 1,
                    price: null,
                    costCenter: ""
                });
            },

            onGoToCart: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteReview");
            }
        });
    }
);
