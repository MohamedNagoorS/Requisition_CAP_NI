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

                // Ensure ID is clean (remote quotes if double wrapped) but ensure wrapped for String UUID
                // CAP Node.js w/ SQLite usually expects UUIDs as Strings -> Requires Quotes: (ID='...')
                var sCleanID = sRequisitionId.replace(/'/g, "");
                var sPath = "/RequisitionHeader(ID='" + sCleanID + "',IsActiveEntity=true)";

                this.getView().bindElement({
                    path: sPath,
                    parameters: {
                        $expand: "items($expand=material),supplier,purchaseGroup"
                    },
                    events: {
                        dataReceived: function (oEvent) {
                            var oError = oEvent.getParameter("error");
                            if (oError) {
                                MessageToast.show("Error fetching data: " + oError.message);
                                return;
                            }
                            this._updateActionState();
                        }.bind(this),
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
                    var sStatus = oReq.status;

                    // 1. General Editability (Only 'Created' is editable)
                    var bIsCreated = (sStatus === 'Created');
                    oViewModel.setProperty("/isEditable", bIsCreated); // Controls ComboBoxes

                    // 2. Button Visibility/Enablement
                    oViewModel.setProperty("/isSendEnabled", bIsCreated); // Send for Approval: Only if Created

                    // Manager Actions (Only if Pending)
                    oViewModel.setProperty("/isManagerActionVisible", (sStatus === 'Pending'));

                    // Default Operations States
                    oViewModel.setProperty("/isGPOEnabled", false);
                    oViewModel.setProperty("/isGIEnabled", false);

                    var aReqItems = oReq.items || [];

                    // Row States (Catalog vs Manual)
                    aReqItems.forEach(function (item) {
                        var bIsManual = !item.material_ID;
                        if (item.ID || item.requisitionItemID) {
                            var sKey = item.ID || item.requisitionItemID;
                            oUiModel.setProperty("/itemStates/" + sKey + "/isManual", bIsManual);
                        }
                    });

                    if (sStatus === "Approved") {
                        // Check Warehouse Stock Logic
                        oViewModel.setProperty("/isGPOEnabled", true); // Default to GPO enabled for Approved

                        var oModel = this.getOwnerComponent().getModel();
                        var oBindList = oModel.bindList("/Warehouse");

                        oBindList.requestContexts().then(function (aWarehouseContexts) {
                            var aWarehouseItems = aWarehouseContexts.map(ctx => ctx.getObject());
                            var bAllItemsInStock = true;

                            if (aReqItems.length === 0) {
                                bAllItemsInStock = false;
                            } else {
                                aReqItems.forEach(function (reqItem) {
                                    // Resolve Material ID from property or expanded object
                                    var sReqMatID = reqItem.material_ID || (reqItem.material && reqItem.material.ID);

                                    // Manual items (no ID) cannot be issued from warehouse
                                    if (!sReqMatID) {
                                        console.log("Item is manual or missing material_ID, cannot issue goods:", reqItem);
                                        bAllItemsInStock = false;
                                        return;
                                    }

                                    var oStock = aWarehouseItems.find(w => w.productID === sReqMatID);

                                    console.log("Checking Stock for:", sReqMatID, "Found:", oStock);

                                    if (!oStock || oStock.quantity < reqItem.quantity) {
                                        console.warn("Insufficient stock or product not found for:", sReqMatID);
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
                var oContext = this.getView().getBindingContext();
                oContext.setProperty("status", "Ordered");

                this.getView().getModel().submitBatch("auto").then(function () {
                    MessageBox.success("Purchase Order Generated! Status updated to 'Ordered'.");
                    // Refresh availability check or disable buttons
                    this._updateActionState();
                }.bind(this)).catch(function (err) {
                    MessageBox.error("Error generating PO: " + err.message);
                });
            },

            onGoodsIssue: function () {
                var oContext = this.getView().getBindingContext();

                // V4: Use requestObject to get data safely
                oContext.requestObject().then(function (oReq) {
                    var aReqItems = oReq.items || [];

                    // 1. Fetch Warehouse Data to update
                    var oModel = this.getView().getModel();
                    var oBindList = oModel.bindList("/Warehouse");

                    oBindList.requestContexts().then(function (aWarehouseContexts) {
                        var bUpdatesMade = false;

                        // 2. Iterate Items and Update Warehouse Stock
                        aReqItems.forEach(function (reqItem) {
                            // Find matching Warehouse 
                            // Note: searching by productID matching material_ID
                            var oWarehouseCtx = aWarehouseContexts.find(ctx => ctx.getProperty("productID") === reqItem.material_ID);

                            if (oWarehouseCtx) {
                                var iCurrentStock = oWarehouseCtx.getProperty("quantity");
                                var iReqQty = reqItem.quantity;

                                if (iCurrentStock >= iReqQty) {
                                    // Deduct Stock
                                    oWarehouseCtx.setProperty("quantity", iCurrentStock - iReqQty);
                                    bUpdatesMade = true;
                                } else {
                                    console.warn("Stock insufficient for item " + reqItem.materialDescription + " during issue. Skipping deduction.");
                                }
                            }
                        });

                        // 3. Update Requisition Status
                        oContext.setProperty("status", "Closed/Issued");

                        // 4. Submit All Changes (Header Status + Warehouse Updates)
                        oModel.submitBatch("auto").then(function () {
                            MessageBox.success("Goods Issued Successfully! Stock updated.");
                            this._updateActionState();
                        }.bind(this)).catch(function (err) {
                            MessageBox.error("Error issuing goods: " + err.message);
                        });

                    }.bind(this)).catch(function (err) {
                        MessageBox.error("Failed to fetch Warehouse data: " + err.message);
                    });
                }.bind(this)).catch(function (err) {
                    MessageBox.error("Failed to read Requisition data: " + err.message);
                });
            },

            onNavBack: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteHome", {}, true);
            },

            onSendForApproval: function () {
                var oContext = this.getView().getBindingContext();
                var sID = oContext.getProperty("ID") || oContext.getProperty("requisitionHeaderID");

                // Set Status to 'Pending' (Matches Manager Filter)
                oContext.setProperty("status", "Pending");

                // Submit Changes
                this.getView().getModel().submitBatch("auto");

                MessageToast.show("Requisition " + sID + " sent to Manager.");

                // Navigate back to Home
                this.getOwnerComponent().getRouter().navTo("RouteHome");
            }
        });
    }
);
