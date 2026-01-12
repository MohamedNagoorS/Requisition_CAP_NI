sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "com/procurement/ui/model/formatter"
], function (Controller, UIComponent, MessageBox, MessageToast, formatter) {
    "use strict";

    return Controller.extend("com.procurement.ui.controller.Admin", {
        formatter: formatter,

        onInit: function () {

        },

        onNavBack: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("RouteHome", {}, true);
        },

        onDeleteRequisition: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext();

            // OData V4 delete
            oContext.delete().then(function () {
                MessageToast.show("Requisition deleted.");
            }).catch(function (error) {
                MessageBox.error("Failed to delete requisition: " + error.message);
            });
        },

        onDeleteAll: function () {
            MessageBox.warning("Are you sure you want to delete ALL requisitions? This cannot be undone.", {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        this._performDeleteAll();
                    }
                }.bind(this)
            });
        },

        _performDeleteAll: function () {
            var oTable = this.byId("adminTable");
            var aItems = oTable.getItems();
            var iCount = aItems.length;
            var iDeleted = 0;

            // Sequential or Batch delete?
            // V4 Batch is implicit via group ID usually. 
            // We can just iterate and call delete() on each context.
            // However, doing many deletes might be slow.

            if (iCount === 0) {
                MessageToast.show("No records to delete.");
                return;
            }

            // Using formatting to submit later? Or auto?
            // Default model is auto.

            var aPromises = [];
            aItems.forEach(function (oItem) {
                var oContext = oItem.getBindingContext();
                aPromises.push(oContext.delete());
            });

            Promise.all(aPromises).then(function () {
                MessageToast.show("All requisitions deleted.");
            }).catch(function (err) {
                MessageBox.error("Error during batch delete: " + err.message);
            });
        }
    });
});
