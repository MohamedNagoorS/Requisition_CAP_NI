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
                    procurementMode: "catalog",
                    quantity: 1,
                    price: 0.00,
                    currency: "USD",
                    manualDescription: "",
                    selectedVendorID: "",
                    selectedMaterialID: null,
                    selectedCostCenterID: null
                });
                this.getView().setModel(oViewModel, "view");
            },

            onModeChange: function (oEvent) {
                var sKey = oEvent.getParameter("item").getKey();
                var oModel = this.getView().getModel("view");

                // Reset fields
                oModel.setProperty("/price", 0.00);
                oModel.setProperty("/manualDescription", "");
                oModel.setProperty("/selectedVendorID", "");
                oModel.setProperty("/selectedMaterialID", null);
                oModel.setProperty("/selectedCostCenterID", null);

                var oCombo = this.byId("materialCombo");
                if (oCombo) oCombo.setSelectedKey(null);
            },

            onMaterialSelect: function (oEvent) {
                var oItem = oEvent.getParameter("selectedItem");
                if (!oItem) return;

                var oContext = oItem.getBindingContext();
                // We handle V4 or standard context
                var oData = oContext.getObject();

                if (!oData) {
                    oContext.requestObject().then(function (oObj) {
                        this._fillCatalogItem(oObj);
                    }.bind(this));
                } else {
                    this._fillCatalogItem(oData);
                }
            },

            _fillCatalogItem: function (oData) {
                var oModel = this.getView().getModel("view");

                // Auto-fill Price (Simulation: 100 per unit for demo, or read from map)
                oModel.setProperty("/price", 100.00);
                oModel.setProperty("/selectedMaterialID", oData.ID);

                // Optional: Auto-select vendor if linked
                // if (oData.supplier_ID) oModel.setProperty("/selectedVendorID", oData.supplier_ID);
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
                var oModel = this.getView().getModel("view");
                var sMode = oModel.getProperty("/procurementMode");
                var sMaterialID = oModel.getProperty("/selectedMaterialID");
                var sManualDesc = oModel.getProperty("/manualDescription");
                var fPrice = oModel.getProperty("/price");
                var iQty = oModel.getProperty("/quantity");
                var sVendor = oModel.getProperty("/selectedVendorID");
                var sCostCenter = oModel.getProperty("/selectedCostCenterID");

                // Validation
                if (sMode === 'catalog' && !sMaterialID) {
                    MessageToast.show("Please select a material.");
                    return;
                }
                if (sMode === 'manual' && !sManualDesc) {
                    MessageToast.show("Please enter a description.");
                    return;
                }
                if (!iQty || iQty <= 0) {
                    MessageToast.show("Quantity must be greater than 0.");
                    return;
                }
                if (!sCostCenter) {
                    MessageToast.show("Please select a Cost Center.");
                    return;
                }

                var oCartModel = this.getOwnerComponent().getModel("cart");
                if (!oCartModel.getProperty("/items")) {
                    oCartModel.setProperty("/items", []);
                }

                var aItems = oCartModel.getProperty("/items") || [];

                // Determine Description
                var sDisplayDesc = sManualDesc;
                if (sMode === 'catalog') {
                    // We need the text from the combo or model. 
                    // Let's assume we can lookup or just use the ID/Placeholder. 
                    // Better: Get it from the Combo selected Item text or store it in _fillCatalogItem.
                    // Implementation: Fetch text from control
                    var oCombo = this.byId("materialCombo");
                    if (oCombo && oCombo.getSelectedItem()) {
                        sDisplayDesc = oCombo.getSelectedItem().getText();
                    } else {
                        // Fallback if combo not found or no item selected, use material ID
                        sDisplayDesc = sMaterialID;
                    }
                }

                // Add to cart
                var aNewItems = aItems.concat([{
                    productId: sMaterialID ? sMaterialID : "MANUAL-" + Date.now(),
                    productName: sDisplayDesc,
                    description: (sMode === 'manual' ? "Manual Entry: " : "Catalog Item: ") + sDisplayDesc,
                    price: parseFloat(fPrice),
                    quantity: parseInt(iQty),
                    costCenter: sCostCenter,
                    vendorId: sVendor || "33300002",
                    type: sMode === 'manual' ? 'Manual' : 'Catalog',
                    material_ID: sMaterialID
                }]);

                oCartModel.setProperty("/items", aNewItems);

                // Update total
                var fTotal = 0;
                aNewItems.forEach(function (item) {
                    fTotal += (parseFloat(item.price) * item.quantity);
                });
                oCartModel.setProperty("/total", fTotal.toFixed(2));

                MessageToast.show("Item added! total " + aNewItems.length + " items in cart.");

                // Reset
                this.onModeChange({ getParameter: () => ({ getKey: () => sMode }) });
                oModel.setProperty("/quantity", 1);
            },

            onGoToCart: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteReview");
            }
        });
    }
);
