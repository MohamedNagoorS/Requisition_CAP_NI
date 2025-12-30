sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, UIComponent, JSONModel, History, MessageToast, MessageBox) {
        "use strict";

        return Controller.extend("com.procurement.ui.controller.Review", {
            onInit: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.getRoute("RouteReview").attachPatternMatched(this._onObjectMatched, this);

                var oViewModel = new JSONModel({
                    currencyCode: "USD"
                });
                this.getView().setModel(oViewModel, "view");
            },

            _onObjectMatched: function () {
                this._calculateTotal();
            },

            _calculateTotal: function () {
                var oCartModel = this.getOwnerComponent().getModel("cart");
                if (!oCartModel) return;

                var aItems = oCartModel.getProperty("/items");
                var fTotal = 0;

                aItems.forEach(function (oItem) {
                    fTotal += (oItem.price * oItem.quantity);
                });

                oCartModel.setProperty("/total", fTotal.toFixed(2));
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

            onSubmit: function () {
                var oCartModel = this.getOwnerComponent().getModel("cart");
                var aItems = oCartModel.getProperty("/items");
                var fTotal = oCartModel.getProperty("/total");

                if (aItems.length === 0) return;

                var oModel = this.getView().getModel(); // OData V4 Model
                var oListBinding = oModel.bindList("/RequisitionHeader");

                var oData = {
                    requestor: "Employee User", // Mock user
                    requestType: aItems[0].type, // Just take first item's type or generic
                    status: "Pending Approval",
                    totalValue: fTotal,
                    selectedVendor: aItems[0].vendorId ? (aItems[0].vendorId === "A" ? "Vendor A" : "Vendor B") : "Manual",
                    items: []
                };

                // Prepare Items
                aItems.forEach(function (item) {
                    oData.items.push({
                        materialName: item.productName,
                        quantity: item.quantity,
                        price: item.price,
                        costCenter: item.costCenter || "Default-CC"
                    });
                });

                // Create
                oListBinding.create(oData).created().then(function () {
                    MessageBox.success("Document sent to Manager for Approval.");

                    // Clear Cart
                    oCartModel.setProperty("/items", []);
                    oCartModel.setProperty("/total", 0);

                    // Nav Home
                    var oRouter = UIComponent.getRouterFor(this);
                    oRouter.navTo("RouteHome");
                }.bind(this)).catch(function (oError) {
                    MessageBox.error("Error creating requisition: " + oError.message);
                });
            }
        });
    }
);
