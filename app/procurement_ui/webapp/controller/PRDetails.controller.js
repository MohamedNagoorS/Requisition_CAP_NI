sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "com/procurement/ui/model/formatter"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, UIComponent, JSONModel, History, MessageToast, MessageBox, formatter) {
        "use strict";

        return Controller.extend("com.procurement.ui.controller.PRDetails", {
            formatter: formatter,

            onInit: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.getRoute("RoutePRDetails").attachPatternMatched(this._onObjectMatched, this);

                var oViewModel = new JSONModel({
                    currencyCode: "USD"
                });
                this.getView().setModel(oViewModel, "view");

                // UI Model for row-specific states (isManual, etc.)
                var oUiModel = new JSONModel({});
                this.getView().setModel(oUiModel, "ui");
            },

            _onObjectMatched: function (oEvent) {
                var sRequisitionId = oEvent.getParameter("arguments").requisitionId;
                var sID = sRequisitionId.includes("'") ? sRequisitionId : "'" + sRequisitionId + "'";
                var sPath = "/RequisitionHeader(ID=" + sID + ",IsActiveEntity=true)";

                this.getView().bindElement({
                    path: sPath,
                    parameters: {
                        $expand: "items,items/material,items/plant,items/costCenter,supplier,purchaseGroup"
                    },
                    events: {
                        dataReceived: this._updateActionState.bind(this),
                        change: this._updateActionState.bind(this)
                    }
                });
            },

            _updateActionState: function () {
                var oContext = this.getView().getBindingContext();
                if (!oContext) return;

                oContext.requestObject().then(function (oReq) {
                    var oViewModel = this.getView().getModel("view");
                    var oUiModel = this.getView().getModel("ui");

                    // Reset States
                    oViewModel.setProperty("/isGPOEnabled", false);
                    oViewModel.setProperty("/isGIEnabled", false);

                    var aReqItems = oReq.items || [];

                    // Initialize Row States (Catalog vs Manual)
                    // We need to know the path for each item to set properties in the UI model.
                    // Since specific paths might be tricky to guess without the list binding context, 
                    // we might need to do this when the table updates or just iterate assuming standard paths?
                    // Better: The Table binding "items" has contexts.
                    // But here we just have the data object.

                    // Alternative: The UI model structure can key by Item UUID.
                    // ui>/items/<uuid>/isManual

                    aReqItems.forEach(function (item) {
                        var bIsManual = !item.material_ID;
                        // We need to map this to the UI model. 
                        // Let's assume the View uses a relative binding to the UI model? 
                        // No, the UI model is absolute {ui>isManual}, so it needs a path.
                        // Actually, in the XML I used {ui>isManual} inside the row. 
                        // This implies the row context should be EXTENDED with this model?
                        // OR, more standard: The UI model has a property matching the binding path.

                        // Let's try to set it by ID if possible, but the binding is tricky.
                        // EASIEST FIX: Just rely on material_ID check in the XML expression?
                        // CheckBox selected="{= !${material_ID} }" ?
                        // But we want to toggle it live. A one-way expression binding won't carry user edits back to a state we can read easily.

                        // Let's stick to the UI model but we need to run this logic AFTER the table has rows.
                        // We can do it in the Table's 'updateFinished' event?
                        // Or just modify the Data itself (transient property).
                        // OData V4 allows client-side properties if defined in metadata? No.

                        // Let's use the UI Model keyed by ID: /itemStates/<ID>/isManual
                        if (item.ID || item.requisitionItemID) {
                            var sKey = item.ID || item.requisitionItemID;
                            oUiModel.setProperty("/itemStates/" + sKey + "/isManual", bIsManual);
                        }
                    });

                    if (oReq.status === "Approved") {
                        // ... existing logic ...
                        oViewModel.setProperty("/isGPOEnabled", true);

                        // Check Warehouse Stock
                        var oModel = this.getOwnerComponent().getModel();
                        var oBindList = oModel.bindList("/Warehouse");

                        oBindList.requestContexts().then(function (aWarehouseContexts) {
                            var aWarehouseItems = aWarehouseContexts.map(ctx => ctx.getObject());
                            var bAllItemsInStock = true;

                            if (aReqItems.length === 0) {
                                bAllItemsInStock = false;
                            } else {
                                // Iterate items to verify stock
                                aReqItems.forEach(function (reqItem) {
                                    // Use material_ID to match Warehouse productID
                                    var oStock = aWarehouseItems.find(w => w.productID === reqItem.material_ID);
                                    // If item not found OR quantity insufficient -> OutOfStock
                                    if (!oStock || oStock.quantity < reqItem.quantity) {
                                        bAllItemsInStock = false;
                                    }
                                });
                            }

                            if (bAllItemsInStock && aReqItems.length > 0) {
                                oViewModel.setProperty("/isGIEnabled", true);
                                oViewModel.setProperty("/isGPOEnabled", false);
                            } else {
                                oViewModel.setProperty("/isGIEnabled", false);
                                oViewModel.setProperty("/isGPOEnabled", true);
                            }
                        }.bind(this)).catch(function (oError) {
                            console.error("Warehouse Check Failed", oError);
                        });
                    }
                }.bind(this)).catch(function (err) {
                    console.error("Context request failed", err);
                });
            },

            onCatalogModeToggle: function (oEvent) {
                var bManual = oEvent.getParameter("selected");
                var oRow = oEvent.getSource().getParent(); // ColumnListItem
                var oCtx = oRow.getBindingContext();

                // We might need a local JSON model to handle row-specific UI state (editability)
                // or just rely on binding if we add a transient property 'isManual' to the OData entity?
                // OData V4 doesn't like transient properties easily.
                // Simpler: Use a separate UI model for row states, keyed by Item ID.
                var oUiModel = this.getView().getModel("ui"); // Assuming we create this on init
                var sPath = oCtx.getPath(); // /RequisitionItem(uuid)
                oUiModel.setProperty(sPath + "/isManual", bManual);

                if (bManual) {
                    // Clear Material ID if switching to manual (optional)
                    oCtx.setProperty("material_ID", null);
                }
            },

            onMaterialSelect: function (oEvent) {
                var oItem = oEvent.getParameter("selectedItem");
                var oContext = oEvent.getSource().getBindingContext();
                if (oItem && oContext) {
                    var sDesc = oItem.getText(); // Description (ID)
                    // We want just the description. The key is ID.
                    // The text property in ComboBox Item is "{description} ({ID})"
                    // Let's split or just use the whole string, or better, bind custom data.
                    // For now, let's look up the object from the model if needed, OR just assume description matches.
                    // Actually, simpler: The ComboBox binding has the data.

                    var oMaterial = oItem.getBindingContext().getObject(); // This might be null if aggregation isn't full
                    // Better: Get key, find in model. OR rely on the text.

                    // Let's use the raw text for description or just "Material " + key
                    // Ideally we fetch the Material Object.

                    // Hack for simulation: Parse the text or just set a placeholder. 
                    // Real solution: The Item context has the objects if using ODataListBinding.

                    // Let's just set description to the main part of text
                    var sCleanDesc = oItem.getText().split("(")[0].trim();

                    oContext.setProperty("materialDescription", sCleanDesc);

                    // Auto-fill price? (Simulation)
                    oContext.setProperty("price", 100.00); // Dummy default
                }
            },

            onUpdateFinished: function () {
                var oTable = this.byId("itemsTable");
                var aItems = oTable.getItems();
                var oUiModel = this.getView().getModel("ui");

                aItems.forEach(function (oItem) {
                    var oCtx = oItem.getBindingContext();
                    if (!oCtx) return;

                    // Get ID
                    var sID = oCtx.getProperty("ID") || oCtx.getProperty("requisitionItemID");
                    if (sID) {
                        // Bind row to the specific item state in UI model
                        oItem.bindElement({
                            path: "/itemStates/" + sID,
                            model: "ui"
                        });
                    }
                });
            },

            onGeneratePO: function () {
                MessageToast.show("Generate Purchase Order: Under Construction");
            },

            onGoodsIssue: function () {
                MessageToast.show("Goods Issue -> Warehouse: Under Construction");
            },

            onNavBack: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteHome", {}, true);
            },

            onSendForApproval: function () {
                var oContext = this.getView().getBindingContext();
                oContext.setProperty("status", "Pending Approval");
                this.getView().getModel().submitBatch("auto");
                MessageBox.success("Requisition Sent for Approval!");
            }
        });
    }
);
