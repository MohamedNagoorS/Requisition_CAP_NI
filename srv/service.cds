using { Procurement_Requisition as my } from '../db/schema.cds';

@path: '/service/procurement_Requisition'
@requires: 'authenticated-user'
service procurement_RequisitionSrv {
  
  // Transactional Entities
  @odata.draft.enabled
  @odata.draft.bypass
  entity RequisitionHeader as projection on my.RequisitionHeader;
  entity RequisitionItem as projection on my.RequisitionItem;
  
  // Legacy/Catalog Entities
  @odata.draft.enabled
  entity VendorCatalogA as projection on my.VendorCatalogA;
  @odata.draft.enabled
  entity VendorCatalogB as projection on my.VendorCatalogB;
  entity Warehouse as projection on my.Warehouse;

  // Master Data Entities (Read-Only)
  @readonly entity Materials as projection on my.Materials;
  @readonly entity Suppliers as projection on my.Suppliers;
  @readonly entity Plants as projection on my.Plants;
  @readonly entity CostCenters as projection on my.CostCenters;
  @readonly entity PurchaseGroups as projection on my.PurchaseGroups;
  @readonly entity Employees as projection on my.Employees;
}

// ---------------------------------------------------------
// UI ANNOTATIONS FOR VALUE HELPS
// ---------------------------------------------------------

annotate procurement_RequisitionSrv.RequisitionItem with {
    material @(
        Common.ValueList: {
            Label: 'Materials',
            CollectionPath: 'Materials',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: material_ID, ValueListProperty: 'ID' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'description' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'type' }
            ]
        },
        Common.Label: 'Material'
    );
    
    plant @(
        Common.ValueList: {
            Label: 'Plants',
            CollectionPath: 'Plants',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: plant_ID, ValueListProperty: 'ID' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
            ]
        },
        Common.Label: 'Plant'
    );

    costCenter @(
        Common.ValueList: {
            Label: 'Cost Centers',
            CollectionPath: 'CostCenters',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: costCenter_ID, ValueListProperty: 'ID' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'description' }
            ]
        },
        Common.Label: 'Cost Center'
    );
};

annotate procurement_RequisitionSrv.RequisitionHeader with {
    supplier @(
        Common.ValueList: {
            Label: 'Suppliers',
            CollectionPath: 'Suppliers',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: supplier_ID, ValueListProperty: 'ID' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'city' }
            ]
        },
        Common.Label: 'Supplier'
    );

    purchaseGroup @(
        Common.ValueList: {
            Label: 'Purchase Groups',
            CollectionPath: 'PurchaseGroups',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: purchaseGroup_ID, ValueListProperty: 'ID' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'description' }
            ]
        },
        Common.Label: 'Purchase Group'
    );
};