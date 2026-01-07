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
                    currencyCode: "USD",
                    globalCostCenter: ""
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

            onCostCenterChange: function (oEvent) {
                // Determine if we need to do anything here. 
                // The view binding {view>/globalCostCenter} already updates the model.
                // The list item display uses expression binding to show global if local is missing.
            },

            onGenerateRequisition: function () {
                var oCartModel = this.getOwnerComponent().getModel("cart");
                var aItems = oCartModel.getProperty("/items");
                var fTotal = oCartModel.getProperty("/total");
                if (aItems.length === 0) return;

                // Validation: ensure all items have a cost center (should be caught at entry)
                // but good to check.
                /* 
                var bMissingCC = aItems.some(item => !item.costCenter);
                if (bMissingCC) { ... } 
                */

                var oModel = this.getView().getModel(); // OData V4 Model
                var oListBinding = oModel.bindList("/RequisitionHeader");

                var oData = {
                    requisitionHeaderID: "PR-" + Date.now(), // Generate a unique ID
                    requestor: "Employee User", // Mock user
                    requestType: aItems[0].type || "Standard",
                    status: "Created", // Initial Status
                    totalValue: fTotal,
                    // selectedVendor: REMOVED. Map to a default supplier for now since cart doesn't have ID.
                    supplier_ID: "33300002", // Default to "Domestic UAE Supplier 2" for demo
                    purchaseGroup_ID: "003", // Default Group
                    companyCode: "3310",     // Default Company
                    IsActiveEntity: true, // Required for draft-enabled entities
                    items: []
                };

                // Prepare Items
                // Prepare Items
                aItems.forEach(function (item, index) {
                    // Use the material_ID we stored in the cart (if Catalog item)
                    // If Manual item, this will be null/undefined, which is correct (Manual Flow)
                    var sMaterialID = item.material_ID || null;

                    oData.items.push({
                        requisitionItemID: "ITEM-" + Date.now() + "-" + index,
                        material_ID: sMaterialID,
                        materialDescription: item.productName || item.description, // Snapshot
                        quantity: item.quantity,
                        price: item.price,
                        costCenter_ID: item.costCenter || "33101101", // Default to Financials if empty but it should be set
                        plant_ID: "3310", // Default Plant
                        IsActiveEntity: true
                    });
                });

                // Create
                var oContext = oListBinding.create(oData);

                oContext.created().then(function () {
                    // Success: The context is now updated with server data
                    var sID = oContext.getProperty("ID");

                    MessageBox.success("Requisition Generated Successfully. ID: " + sID);

                    // Clear Cart
                    oCartModel.setProperty("/items", []);
                    oCartModel.setProperty("/total", 0);
                    this.getView().getModel("view").setProperty("/globalCostCenter", "");

                    // Nav to PR Details
                    var oRouter = UIComponent.getRouterFor(this);
                    oRouter.navTo("RoutePRDetails", {
                        requisitionId: sID
                    });
                }.bind(this)).catch(function (oError) {
                    console.error("Creation Error:", oError);
                    MessageBox.error("Error creating requisition: " + oError.message);
                });
            }
        });
    }
);
