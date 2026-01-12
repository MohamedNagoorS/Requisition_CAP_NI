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
                var sID = oContext.getProperty("ID");
                var sDisplayID = oContext.getProperty("requisitionHeaderID") || "PO-" + sID.substring(0, 8);

                // Get deeply nested data from the binding
                // Note: We need to ensure we have the data. requestObject is safest.
                oContext.requestObject().then(function (oReq) {
                    // Update Status first
                    oContext.setProperty("status", "Ordered");
                    this.getView().getModel().submitBatch("auto");

                    // Generate PDF
                    try {
                        const { jsPDF } = window.jspdf;
                        if (!jsPDF) {
                            MessageBox.error("jsPDF library not loaded. Please check internet connection.");
                            return;
                        }

                        var doc = new jsPDF();

                        // Colors
                        var primaryColor = [0, 166, 81]; // Green #00A651
                        var secondaryColor = [0, 128, 0];
                        var greyColor = [128, 128, 128];
                        var blackColor = [0, 0, 0];

                        // --- HEADER ---
                        // Logo Placeholder (Using Text for now or a simple circle)
                        doc.setFillColor(...primaryColor);
                        // doc.circle(20, 20, 10, 'F');
                        doc.setTextColor(...primaryColor);
                        doc.setFontSize(22);
                        doc.setFont("helvetica", "bold");
                        doc.text("GimBooks", 15, 25);

                        // Right Side Header
                        doc.setTextColor(...primaryColor);
                        doc.setFontSize(24);
                        doc.text("PURCHASE ORDER", 200, 20, { align: "right" });

                        doc.setTextColor(...blackColor); // Black
                        doc.setFontSize(10);
                        doc.setFont("helvetica", "normal");
                        var sDate = new Date().toLocaleDateString();
                        doc.text("DATE", 160, 30);
                        doc.text(sDate, 200, 30, { align: "right" });
                        doc.text("PO #", 160, 35);
                        doc.text(sDisplayID, 200, 35, { align: "right" });

                        // --- COMPANY INFO (Top Left) ---
                        doc.setFontSize(9);
                        doc.setTextColor(...blackColor);
                        var iY = 35;
                        doc.text("[Street Address]", 15, iY += 5);
                        doc.text("[City, ST ZIP]", 15, iY += 5);
                        doc.text("Phone: (000) 000-0000", 15, iY += 5);
                        doc.text("Fax: (000) 000-0000", 15, iY += 5);
                        doc.text("Website: www.gimbooks.com", 15, iY += 5);

                        // --- VENDOR & SHIP TO SECTIONS ---
                        var iSectionY = 70;
                        var iCol2X = 110;

                        // Headers
                        doc.setFillColor(...primaryColor);
                        doc.rect(15, iSectionY, 80, 7, 'F'); // Vendor Box
                        doc.rect(iCol2X, iSectionY, 80, 7, 'F'); // Ship To Box

                        doc.setTextColor(255, 255, 255); // White
                        doc.setFont("helvetica", "bold");
                        doc.text("VENDOR", 17, iSectionY + 5);
                        doc.text("SHIP TO", iCol2X + 2, iSectionY + 5);

                        // Content
                        doc.setTextColor(...blackColor);
                        doc.setFont("helvetica", "normal");
                        var iVendorY = iSectionY + 12;
                        var oSupplier = oReq.supplier || { name: "Unknown Vendor", city: "Unknown" };

                        doc.text(oSupplier.name || "[Company Name]", 15, iVendorY);
                        doc.text("[Contact or Department]", 15, iVendorY += 5);
                        doc.text(oSupplier.city || "[Street Address]", 15, iVendorY += 5);
                        doc.text("[City, ST ZIP]", 15, iVendorY += 5);
                        doc.text("Phone: (000) 000-0000", 15, iVendorY += 5);

                        var iShipY = iSectionY + 12;
                        doc.text(oReq.requestor || "[Name]", iCol2X, iShipY);
                        doc.text(oReq.companyCode || "[Company Name]", iCol2X, iShipY += 5);
                        doc.text("[Street Address]", iCol2X, iShipY += 5);
                        doc.text("[City, ST ZIP]", iCol2X, iShipY += 5);
                        doc.text("Phone: [Phone]", iCol2X, iShipY += 5);

                        // --- REQUISITION DETAILS BAR ---
                        var iBarY = 110;
                        doc.setFillColor(...primaryColor);
                        doc.rect(15, iBarY, 190, 7, 'F');

                        doc.setTextColor(255, 255, 255);
                        doc.setFont("helvetica", "bold");
                        // 4 Columns: Requisitioner, Ship Via, F.O.B., Shipping Terms
                        // Approx Widths: 40, 50, 40, 60
                        doc.text("REQUISITIONER", 20, iBarY + 5);
                        doc.text("SHIP VIA", 70, iBarY + 5);
                        doc.text("F.O.B.", 120, iBarY + 5);
                        doc.text("SHIPPING TERMS", 160, iBarY + 5);

                        doc.setTextColor(...blackColor);
                        doc.setFont("helvetica", "normal");
                        doc.text(oReq.requestor || "Employee", 20, iBarY + 14);
                        doc.text("Ground", 70, iBarY + 14); // Placeholder
                        doc.text("Origin", 120, iBarY + 14); // Placeholder
                        doc.text("Prepaid", 160, iBarY + 14); // Placeholder

                        // Line under details
                        doc.setDrawColor(...primaryColor);
                        doc.line(15, iBarY + 16, 205, iBarY + 16);

                        // --- TABLE ---
                        // Prepare Data
                        var kpData = [];
                        var fSubtotal = 0.0;
                        var aItems = oReq.items || [];

                        aItems.forEach(function (item) {
                            var fTotal = parseFloat(item.price) * item.quantity; // Price is unit price?
                            // Assuming price in DB is Unit Price based on UI context
                            fSubtotal += fTotal;

                            kpData.push([
                                item.material_ID || "M-00X", // Item #
                                item.materialDescription || "Item Description", // Description
                                item.quantity,
                                parseFloat(item.price).toFixed(2),
                                fTotal.toFixed(2)
                            ]);
                        });

                        // Empty rows filler to match look
                        while (kpData.length < 15) {
                            kpData.push(["", "", "", "", ""]);
                        }

                        doc.autoTable({
                            startY: 130,
                            head: [['ITEM #', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL']],
                            body: kpData,
                            theme: 'plain',
                            headStyles: {
                                fillColor: primaryColor,
                                textColor: [255, 255, 255],
                                fontStyle: 'bold',
                                halign: 'center'
                            },
                            columnStyles: {
                                0: { cellWidth: 30 },
                                1: { cellWidth: 80 },
                                2: { cellWidth: 20, halign: 'center' },
                                3: { cellWidth: 30, halign: 'right' },
                                4: { cellWidth: 30, halign: 'right', fillColor: [240, 240, 240] } // Light grey background for total column
                            },
                            styles: {
                                lineColor: primaryColor,
                                lineWidth: 0.1,
                                fontSize: 9
                            },
                            margin: { top: 130, left: 15, right: 10 }
                        });

                        // --- TOTALS SECTION ---
                        var finalY = doc.lastAutoTable.finalY + 5;
                        var iTotalX = 140;
                        var iValX = 200;

                        doc.setFont("helvetica", "normal");
                        doc.text("SUBTOTAL", iTotalX, finalY);
                        doc.text(fSubtotal.toFixed(2), iValX, finalY, { align: "right" });

                        doc.text("TAX", iTotalX, finalY += 6);
                        doc.text("-", iValX, finalY, { align: "right" });

                        doc.text("SHIPPING", iTotalX, finalY += 6);
                        doc.text("-", iValX, finalY, { align: "right" });

                        doc.text("OTHER", iTotalX, finalY += 6);
                        doc.text("-", iValX, finalY, { align: "right" });

                        // Total Bar
                        doc.setFillColor(255, 200, 0); // Orange/Yellow
                        doc.rect(iTotalX - 5, finalY + 2, 70, 8, 'F');

                        doc.setTextColor(...blackColor);
                        doc.setFont("helvetica", "bold");
                        doc.text("TOTAL", iTotalX, finalY + 7);
                        doc.text("$ " + fSubtotal.toFixed(2), iValX, finalY + 7, { align: "right" });

                        // --- COMMENTS ---
                        // Left side aligned with totals top
                        var iCommentY = doc.lastAutoTable.finalY + 5;
                        doc.setFillColor(...primaryColor);
                        doc.rect(15, iCommentY, 100, 6, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(10);
                        doc.text("Comments or Special Instructions", 17, iCommentY + 4);

                        // --- FOOTER ---
                        var pageHeight = doc.internal.pageSize.height;
                        doc.setTextColor(...blackColor);
                        doc.setFontSize(9);
                        doc.setFont("helvetica", "normal");
                        doc.text("If you have any questions about this purchase order, please contact", 105, pageHeight - 20, { align: "center" });
                        doc.text("[Name, Phone #, E-mail]", 105, pageHeight - 15, { align: "center" });

                        // Border around page (Green)
                        doc.setDrawColor(...primaryColor);
                        doc.setLineWidth(0.5);
                        doc.rect(5, 5, 200, 287);

                        doc.save("PurchaseOrder_" + sDisplayID + ".pdf");
                        MessageBox.success("Purchase Order PDF Generated!");

                    } catch (e) {
                        MessageBox.error("PDF Generation failed: " + e.message);
                        console.error(e);
                    }

                }.bind(this)).catch(function (err) {
                    MessageBox.error("Error fetching data for PO: " + err.message);
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
