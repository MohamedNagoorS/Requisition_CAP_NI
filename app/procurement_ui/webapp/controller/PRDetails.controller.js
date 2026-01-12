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
                var oView = this.getView();
                var oContext = oView.getBindingContext();
                var sID = oContext.getProperty("ID");
                var sDisplayID = oContext.getProperty("requisitionHeaderID") || "PO-" + sID.substring(0, 8);

                // 1. Get Header Data via Property Binding (Primitives) to avoid V4 errors
                var sRequestor = oContext.getProperty("requestor");
                var sCompanyCode = oContext.getProperty("companyCode");
                var sSupplierName = oContext.getProperty("supplier/name");
                var sSupplierCity = oContext.getProperty("supplier/city");

                // Fallback if direct expansion property fails (e.g. if binding is weird)
                if (!sSupplierName) {
                    // Try to get from ComboBox if it's there
                    var oSupplierCombo = this.byId("supplierCombo"); // Assuming ID, but view didn't have ID. 
                    // View has: <ComboBox items="{/Suppliers}" selectedKey="{supplier_ID}" ...>
                    // Let's try to find the selected item from the binding context of the supplier relation if possible
                    // Or just default to "Unknown"
                    sSupplierName = "Unknown Vendor";
                    sSupplierCity = "Unknown City";
                }

                var oReq = {
                    requestor: sRequestor,
                    companyCode: sCompanyCode,
                    supplier: {
                        name: sSupplierName,
                        city: sSupplierCity
                    }
                };

                // 2. Get Line Items directly from the Table to ensure WYSIWYG
                var aTableItems = oView.byId("itemsTable").getItems();
                var aItemsData = [];
                aTableItems.forEach(function (oItem) {
                    var oItemContext = oItem.getBindingContext();
                    if (oItemContext) {
                        aItemsData.push({
                            material_ID: oItemContext.getProperty("material_ID"),
                            materialDescription: oItemContext.getProperty("materialDescription"),
                            quantity: oItemContext.getProperty("quantity"),
                            price: oItemContext.getProperty("price"),
                            // Also get nested material info for fallback
                            material: {
                                ID: oItemContext.getProperty("material/ID"),
                                description: oItemContext.getProperty("material/description")
                            }
                        });
                    }
                });

                // Update Status first
                oContext.setProperty("status", "Ordered");
                oView.getModel().submitBatch("auto");

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
                    var blackColor = [0, 0, 0];

                    // --- HEADER ---
                    doc.setFillColor(...primaryColor);
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
                    doc.text("GimBooks Inc.", 15, iY += 5);
                    doc.text("1234 Innovation Drive", 15, iY += 5);
                    doc.text("Tech City, TC 90210", 15, iY += 5);
                    doc.text("Phone: (555) 123-4567", 15, iY += 5);
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
                    doc.setTextColor(...blackColor); // Back to Black
                    doc.setFont("helvetica", "normal");
                    var iVendorY = iSectionY + 12;

                    // Use captured Primitive Data
                    var sVName = oReq.supplier.name;
                    // If still unknown, check if we can get it from context property with slash
                    if (sVName === "Unknown Vendor" && oContext.getProperty("supplier/name")) {
                        sVName = oContext.getProperty("supplier/name");
                        sSupplierCity = oContext.getProperty("supplier/city");
                    }

                    doc.text(sVName || "Vendor Name", 15, iVendorY);
                    doc.text("Department: Sales", 15, iVendorY += 5);
                    doc.text(sSupplierCity || "City, Country", 15, iVendorY += 5);
                    doc.text("Phone: (000) 000-0000", 15, iVendorY += 5);

                    var iShipY = iSectionY + 12;
                    // Mock Address based on Company Code
                    var sShipName = oReq.requestor || "Employee User";
                    var sShipCompany = "Tech Solutions Inc. (Global HQ)";
                    var sShipAddr1 = "456 Corporate Blvd";
                    var sShipAddr2 = "New York, NY 10001";

                    doc.text(sShipName, iCol2X, iShipY);
                    doc.text(sShipCompany, iCol2X, iShipY += 5);
                    doc.text(sShipAddr1, iCol2X, iShipY += 5);
                    doc.text(sShipAddr2, iCol2X, iShipY += 5);
                    doc.text("Phone: (212) 555-9999", iCol2X, iShipY += 5);

                    // --- REQUISITION DETAILS BAR ---
                    var iBarY = 110;
                    doc.setFillColor(...primaryColor);
                    doc.rect(15, iBarY, 190, 7, 'F');

                    doc.setTextColor(255, 255, 255);
                    doc.setFont("helvetica", "bold");
                    doc.text("REQUISITIONER", 20, iBarY + 5);
                    doc.text("SHIP VIA", 70, iBarY + 5);
                    doc.text("F.O.B.", 120, iBarY + 5);
                    doc.text("SHIPPING TERMS", 160, iBarY + 5);

                    doc.setTextColor(...blackColor);
                    doc.setFont("helvetica", "normal");
                    doc.text(oReq.requestor || "Employee", 20, iBarY + 14);
                    doc.text("FedEx Ground", 70, iBarY + 14);
                    doc.text("Origin", 120, iBarY + 14);
                    doc.text("Prepaid", 160, iBarY + 14);

                    doc.setDrawColor(...primaryColor);
                    doc.line(15, iBarY + 16, 205, iBarY + 16);

                    // --- TABLE ---
                    var kpData = [];
                    var fSubtotal = 0.0;

                    aItemsData.forEach(function (item) {
                        var fTotal = parseFloat(item.price) * item.quantity;
                        fSubtotal += fTotal;

                        // Fix Item # logic: Use material_ID or nested material.ID or 'Manual'
                        var sMatID = item.material_ID;
                        if (!sMatID && item.material) {
                            sMatID = item.material.ID;
                        }
                        if (!sMatID) {
                            sMatID = ""; // Changed to Blank as per request/professional look
                        }

                        // Fix Description: Use materialDescription or nested material.description
                        var sDesc = item.materialDescription;
                        if (!sDesc && item.material) {
                            sDesc = item.material.description;
                        }

                        kpData.push([
                            sMatID,
                            sDesc || "Item Description",
                            item.quantity,
                            parseFloat(item.price).toFixed(2),
                            fTotal.toFixed(2)
                        ]);
                    });

                    // Empty rows filler
                    while (kpData.length < 12) {
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
                            4: { cellWidth: 30, halign: 'right', fillColor: [240, 240, 240] }
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

                    doc.text("TAX", iTotalX, finalY += 5);
                    doc.text("0.00", iValX, finalY, { align: "right" });

                    doc.text("SHIPPING", iTotalX, finalY += 5);
                    doc.text("0.00", iValX, finalY, { align: "right" });

                    doc.text("OTHER", iTotalX, finalY += 5);
                    doc.text("0.00", iValX, finalY, { align: "right" });

                    // Total Bar
                    doc.setFillColor(255, 200, 0); // Orange/Yellow
                    doc.rect(iTotalX - 5, finalY + 2, 70, 8, 'F');

                    doc.setTextColor(...blackColor);
                    doc.setFont("helvetica", "bold");
                    doc.text("TOTAL", iTotalX, finalY + 7);
                    doc.text("$ " + fSubtotal.toFixed(2), iValX, finalY + 7, { align: "right" });

                    // --- COMMENTS ---
                    var iCommentY = doc.lastAutoTable.finalY + 5;
                    doc.setFillColor(...primaryColor);
                    doc.rect(15, iCommentY, 100, 6, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(10);
                    doc.text("Comments or Special Instructions", 17, iCommentY + 4);

                    // --- FOOTER ---
                    var pageHeight = doc.internal.pageSize.height;
                    doc.setTextColor(...blackColor); // Reset to black
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    doc.text("If you have any questions about this purchase order, please contact", 105, pageHeight - 20, { align: "center" });
                    doc.text("[Name, Phone #, E-mail]", 105, pageHeight - 15, { align: "center" });

                    doc.setDrawColor(...primaryColor);
                    doc.setLineWidth(0.5);
                    doc.rect(5, 5, 200, 287);

                    doc.save("PurchaseOrder_" + sDisplayID + ".pdf");
                    MessageBox.success("Purchase Order PDF Generated!");

                } catch (e) {
                    MessageBox.error("PDF Generation failed: " + e.message);
                    console.error(e);
                }
            },

            onGoodsIssue: function () {
                var oContext = this.getView().getBindingContext();

                // V4: Use requestObject to get data safely
                oContext.requestObject().then(function (oReq) {
                    var aReqItems = oReq.items || [];
                    var sPOID = oReq.requisitionHeaderID; // PO Number for PDF

                    // 1. Fetch Warehouse Data to update
                    var oModel = this.getView().getModel();
                    var oBindList = oModel.bindList("/Warehouse");

                    oBindList.requestContexts().then(function (aWarehouseContexts) {
                        var bUpdatesMade = false;
                        var aPDFItems = []; // Collect data for PDF

                        // 2. Iterate Items and Update Warehouse Stock
                        aReqItems.forEach(function (reqItem) {
                            // Find matching Warehouse 
                            // Note: searching by productID matching material_ID
                            var oWarehouseCtx = aWarehouseContexts.find(ctx => ctx.getProperty("productID") === reqItem.material_ID);
                            var sLocation = "";

                            if (oWarehouseCtx) {
                                var iCurrentStock = oWarehouseCtx.getProperty("quantity");
                                var iReqQty = reqItem.quantity;
                                sLocation = oWarehouseCtx.getProperty("location") || ""; // Get Location for PDF

                                if (iCurrentStock >= iReqQty) {
                                    // Deduct Stock
                                    oWarehouseCtx.setProperty("quantity", iCurrentStock - iReqQty);
                                    bUpdatesMade = true;
                                } else {
                                    console.warn("Stock insufficient for item " + reqItem.materialDescription + " during issue. Skipping deduction.");
                                }
                            }

                            // Prepare Item Data for PDF
                            aPDFItems.push({
                                qty: reqItem.quantity,
                                po: sPOID,
                                description: reqItem.materialDescription,
                                weight: "", // Not available
                                volumen: "", // Not available
                                volWeight: "", // Not available
                                location: sLocation
                            });
                        });

                        // 3. Update Requisition Status
                        oContext.setProperty("status", "Closed/Issued");

                        // 4. Submit All Changes (Header Status + Warehouse Updates)
                        oModel.submitBatch("auto").then(function () {
                            console.log("Goods Issue Submitted. Generating Receipt...");
                            MessageBox.success("Goods Issued Successfully! Receipt Generated.");
                            this._updateActionState();

                            // --- GENERATE PDF ---
                            if (this._generateGoodsReceiptPDF) {
                                this._generateGoodsReceiptPDF(sPOID, aPDFItems);
                            } else {
                                console.error("_generateGoodsReceiptPDF not defined");
                            }

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

            _generateGoodsReceiptPDF: function (sPOID, aItems) {
                try {
                    // Safety check for jsPDF
                    if (!window.jspdf) {
                        MessageBox.error("jsPDF library not found. Please reload the page.");
                        return;
                    }

                    const { jsPDF } = window.jspdf;
                    var doc = new jsPDF();

                    // --- HEADER ---
                    doc.setFontSize(22);
                    doc.setTextColor(0, 100, 0); // Dark Green
                    doc.text("GimBooks", 15, 20); // Replaces Linbis logo

                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    doc.text("GimBooks Inc.", 60, 15);
                    doc.text("5410 NW 72 Ave", 60, 20);
                    doc.text("Miami, FL 33126 US", 60, 25);
                    doc.text("Phone: 800-519-5322 Fax: 888-515-4522", 60, 30);
                    doc.text("info@gimbooks.com", 60, 35);
                    doc.text("www.gimbooks.com", 60, 40);

                    doc.setFontSize(16);
                    doc.setTextColor(150, 150, 150); // Grey
                    doc.text("WAREHOUSE RECEIPT", 140, 15);

                    // Mock Barcode
                    doc.setLineWidth(0.5);
                    for (var i = 0; i < 40; i++) {
                        doc.line(140 + (i * 1.5), 20, 140 + (i * 1.5), 30);
                    }
                    doc.setFontSize(12);
                    doc.setTextColor(0, 0, 0);
                    doc.text("WRI" + sPOID.replace("PR-", ""), 140, 35); // Receipt #

                    doc.setFontSize(8);
                    doc.text("Printed On: " + new Date().toLocaleDateString(), 15, 50);

                    // --- BOXES ---
                    doc.setLineWidth(0.1);

                    // SHIPPER BOX
                    doc.rect(15, 55, 90, 30);
                    doc.setFillColor(240, 240, 240);
                    doc.rect(15, 55, 90, 5, 'F');
                    doc.setFont("helvetica", "bold");
                    doc.text("SHIPPER", 17, 59);

                    doc.setFont("helvetica", "normal");
                    doc.text("FedEx Express", 17, 65);
                    doc.text("123 Logistics Way", 17, 70);
                    doc.text("Memphis, TN 38120", 17, 75);
                    doc.text("United States", 17, 80);

                    // CONSIGNEE BOX
                    doc.rect(15, 90, 90, 30);
                    doc.setFillColor(240, 240, 240);
                    doc.rect(15, 90, 90, 5, 'F');
                    doc.setFont("helvetica", "bold");
                    doc.text("CONSIGNEE", 17, 94);

                    doc.setFont("helvetica", "normal");
                    doc.text("GimBooks Inc.", 17, 100);
                    doc.text("11001 SW 8th Street", 17, 105);
                    doc.text("Doral, FL 33428", 17, 110);
                    doc.text("United States", 17, 115);

                    // CHECKBOXES (Right Side)
                    var checkX = 110;
                    var checkY = 55;
                    var checkLabels = ["COMMERCIAL INVOICE", "PACKING LIST", "HAZARDOUS MATERIAL", "BONDED", "OVERSIZE", "OVERWEIGHT", "DISCREPANCY", "FRAGILE"];

                    checkLabels.forEach(function (label, index) {
                        var x = index < 4 ? checkX : checkX + 50;
                        var y = index < 4 ? checkY + (index * 8) : checkY + ((index - 4) * 8);
                        doc.rect(x, y, 4, 4);
                        doc.text(label, x + 6, y + 3);
                    });

                    // ADDITIONAL INFO
                    doc.rect(108, 90, 90, 30);
                    doc.setFillColor(240, 240, 240);
                    doc.rect(108, 90, 90, 5, 'F');
                    doc.setFont("helvetica", "bold");
                    doc.text("ADDITIONAL INFORMATION", 110, 94);

                    doc.setFont("helvetica", "bold");
                    doc.text("DATE IN:", 110, 100);
                    doc.setFont("helvetica", "normal");
                    doc.text(new Date().toLocaleDateString(), 130, 100);

                    doc.setFont("helvetica", "bold");
                    doc.text("DIVISION:", 110, 105);
                    doc.setFont("helvetica", "normal");
                    doc.text("Miami", 130, 105);

                    // --- TABLE ---
                    var finalY = 125;

                    var tableBody = aItems.map(item => [
                        item.qty,
                        item.po,
                        item.description,
                        item.weight,
                        item.volumen,
                        item.volWeight,
                        item.location
                    ]);

                    // Add totals row if needed
                    var totalQty = aItems.reduce((sum, item) => sum + item.qty, 0);

                    doc.autoTable({
                        startY: 125,
                        head: [['QTY', 'PO', 'ITEM / DESCRIPTION', 'WEIGHT', 'VOLUMEN', 'VOL WEIGHT', 'LOCATION']],
                        body: tableBody,
                        theme: 'plain',
                        styles: {
                            lineColor: [0, 0, 0],
                            lineWidth: 0.1,
                            fontSize: 8
                        },
                        headStyles: {
                            fillColor: [255, 255, 255],
                            textColor: [0, 0, 0],
                            fontStyle: 'bold',
                            lineWidth: 0.1,
                            lineColor: [0, 0, 0] // bordered header
                        }
                    });

                    finalY = doc.lastAutoTable.finalY;

                    // Totals Box
                    doc.autoTable({
                        startY: finalY, // attach to bottom
                        head: [['PIECES', 'WEIGHT', 'VOLUME', 'VOL. WEIGHT']],
                        body: [[totalQty, "0.00 kg", "0.00 m3", "0.00 kg"]],
                        theme: 'plain',
                        styles: {
                            lineColor: [0, 0, 0],
                            lineWidth: 0.1,
                            fontSize: 8,
                            halign: 'center'
                        },
                        headStyles: {
                            fillColor: [255, 255, 255],
                            textColor: [0, 0, 0],
                            fontStyle: 'bold'
                        },
                        tableWidth: 100,
                        margin: { left: 108 } // Right align roughly
                    });

                    // Save
                    doc.save("GoodsReceipt_" + sPOID + ".pdf");
                } catch (e) {
                    console.error("PDF Generation Error: ", e);
                    MessageBox.error("Failed to generate PDF: " + e.message);
                }
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
