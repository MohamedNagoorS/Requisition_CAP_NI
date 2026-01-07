namespace Procurement_Requisition;
using { cuid, managed } from '@sap/cds/common';

// ---------------------------------------------------------
// 1. MASTER DATA ENTITIES
// ---------------------------------------------------------

entity Materials {
  key ID          : String(40);
      description : String(100);
      type        : String(10);
}

entity Suppliers {
  key ID          : String(10);
      name        : String(100);
      city        : String(40);
}

entity Plants {
  key ID          : String(4);
      name        : String(40);
      companyCode : String(4);
}

entity CostCenters {
  key ID          : String(10);
      description : String(40);
}

entity PurchaseGroups {
  key ID          : String(3);
      description : String(40);
}

entity Employees {
  key ID    : String(10);
      name  : String(100);
      email : String(100);
}

// ---------------------------------------------------------
// 2. TRANSACTIONAL ENTITIES
// ---------------------------------------------------------

@assert.unique: { requisitionHeaderID: [requisitionHeaderID] }
entity RequisitionHeader : cuid, managed {
  requisitionHeaderID : String(36) @mandatory;
  requestor           : String(100);
  requestType         : String(20);
  
  // Master Data Associations
  supplier            : Association to Suppliers; 
  purchaseGroup       : Association to PurchaseGroups;
  companyCode         : String(4) default '3310'; 
  
  // Financials
  totalValue          : Decimal(10,2);
  status              : String(20);
  
  items               : Composition of many RequisitionItem on items.header = $self;
}

@assert.unique: { requisitionItemID: [requisitionItemID] }
entity RequisitionItem : cuid {
  requisitionItemID : String(36) @mandatory;
  
  // Master Data Associations
  material          : Association to Materials;
  materialDescription : String(100); // Snapshot or Manual Description
  plant             : Association to Plants;
  costCenter        : Association to CostCenters;
  
  quantity          : Integer;
  price             : Decimal(10,2);
  
  header            : Association to RequisitionHeader;
}

// ---------------------------------------------------------
// 3. CATALOG & WAREHOUSE (Legacy/Catalog Flow)
// ---------------------------------------------------------

@assert.unique: { vendorCatalogAID: [vendorCatalogAID] }
entity VendorCatalogA : cuid {
  vendorCatalogAID : String(36) @mandatory;
  productName      : String(100);
  description      : String(500);
  unitPrice        : Decimal(10,2);
  stockLevel       : Integer;
  category         : String(100);
}

@assert.unique: { vendorCatalogBID: [vendorCatalogBID] }
entity VendorCatalogB : cuid {
  vendorCatalogBID : String(36) @mandatory;
  productName      : String(100);
  description      : String(500);
  unitPrice        : Decimal(10,2);
  stockLevel       : Integer;
  category         : String(100);
}

@assert.unique: { productID: [productID] }
entity Warehouse : cuid {
  productID   : String(36) @mandatory;
  productName : String(100);
  quantity    : Integer;
  location    : String(50);
}
