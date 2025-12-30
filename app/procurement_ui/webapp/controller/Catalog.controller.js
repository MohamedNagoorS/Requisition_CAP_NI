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

        return Controller.extend("com.procurement.ui.controller.Catalog", {
            onInit: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.getRoute("RouteCatalog").attachPatternMatched(this._onObjectMatched, this);

                var oViewModel = new JSONModel({
                    currencyCode: "USD"
                });
                this.getView().setModel(oViewModel, "view");
            },

            _onObjectMatched: function (oEvent) {
                var sVendorId = oEvent.getParameter("arguments").vendorId;
                this._loadCatalog(sVendorId);
            },

            _loadCatalog: function (sVendorId) {
                var sEntitySet = sVendorId === "A" ? "/VendorCatalogA" : "/VendorCatalogB";
                var oModel = this.getView().getModel(); // OData V4 model

                // We need to bind the list to this entity set.
                // However, since we want to manually handle "Add to Cart" and maybe mix data, 
                // let's just bind the List in the view directly to a JSON model we populate, 
                // OR better, bind the List to the OData model directly but changing the path.

                // Let's us a JSON model for the catalog items for simplicity and client-side manipulation if needed,
                // but reading from OData.

                // Actually, standard UI5 binding is best.
                // We will update the List binding path.

                var oList = this.byId(this.createId("list")); // If I gave ID. 
                // But I didn't give ID in XML. Let's select by type or just bind in XML with a placeholder and update here?
                // Easier: Use a JSON Model 'catalog' for the view.

                var oCatalogModel = new JSONModel({ items: [] });
                this.getView().setModel(oCatalogModel, "catalog");

                var oODataModel = this.getOwnerComponent().getModel();
                var oListBinding = oODataModel.bindList(sEntitySet);

                oListBinding.requestContexts().then(function (aContexts) {
                    var aItems = aContexts.map(ctx => ctx.getObject());
                    oCatalogModel.setProperty("/items", aItems);
                });

                // Store vendor ID for later
                this.sCurrentVendorId = sVendorId;
            },

            onNavBack: function () {
                var oHistory = History.getInstance();
                var sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    var oRouter = UIComponent.getRouterFor(this);
                    oRouter.navTo("RouteVendorSelection", {}, true);
                }
            },

            onAddToCart: function (oEvent) {
                var oItem = oEvent.getSource().getBindingContext("catalog").getObject();

                var oCartModel = this.getOwnerComponent().getModel("cart");
                if (!oCartModel) {
                    oCartModel = new JSONModel({ items: [], total: 0 });
                    this.getOwnerComponent().setModel(oCartModel, "cart");
                }

                var aItems = oCartModel.getProperty("/items");

                // Add to cart
                aItems.push({
                    productId: oItem.vendorCatalogAID || oItem.vendorCatalogBID,
                    productName: oItem.productName,
                    description: oItem.description,
                    price: oItem.unitPrice,
                    quantity: 1, // Default 1
                    vendorId: this.sCurrentVendorId,
                    type: 'Catalog'
                });

                oCartModel.setProperty("/items", aItems);
                MessageToast.show("Added to cart: " + oItem.productName);
            },

            onGoToCart: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteReview");
            }
        });
    }
);
