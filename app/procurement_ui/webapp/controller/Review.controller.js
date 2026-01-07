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
                var sGlobalCostCenter = this.getView().getModel("view").getProperty("/globalCostCenter");

                if (aItems.length === 0) return;

                if (!sGlobalCostCenter) {
                    MessageToast.show("Please enter a Global Cost Center.");
                    return;
                }

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
                aItems.forEach(function (item, index) {
                    // Logic to map product name to ID? 
                    // In real app, cart items should have IDs. 
                    // For now, we hardcode to the material inputs if name matches, or just default.
                    var sMaterialID = "TG0011";
                    if (item.productName && item.productName.includes("High Value")) sMaterialID = "TG0012";

                    oData.items.push({
                        requisitionItemID: "ITEM-" + Date.now() + "-" + index,
                        material_ID: sMaterialID, // Association (might be defaulting to TG0011)
                        materialDescription: item.productName || item.description, // Snapshot
                        quantity: item.quantity,
                        price: item.price,
                        costCenter_ID: sGlobalCostCenter || "33101101", // Default to Financials if empty
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
