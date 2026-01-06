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
            },

            _onObjectMatched: function (oEvent) {
                var sRequisitionId = oEvent.getParameter("arguments").requisitionId;

                // Bind the view to the specific Requisition
                // Bind the view to the specific Requisition
                // Note: For draft-enabled entities, the key includes IsActiveEntity.
                var sID = sRequisitionId.includes("'") ? sRequisitionId : "'" + sRequisitionId + "'";
                var sPath = "/RequisitionHeader(ID=" + sID + ",IsActiveEntity=true)";
                this.getView().bindElement({
                    path: sPath,
                    parameters: {
                        $expand: "items"
                    }
                });
            },

            onNavBack: function () {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteHome", {}, true);
            },

            onSendForApproval: function () {
                // Update the status to 'Pending Approval'
                var oContext = this.getView().getBindingContext();

                oContext.setProperty("status", "Pending Approval");

                // Submit changes
                // In OData V4, setProperty updates locally. We rely on model's auto or manual submit.
                // Assuming auto-submit or grouped.
                // If operationMode is Server (default), it creates a PATCH request.

                // Note: The correct way in V4 might be context.requestProperty or just updating and catch errors.
                // However, setProperty on a bound context triggers PATCH if the property is part of the binding.

                this.getView().getModel().submitBatch("auto").then(function () { // If batch group is auto, it might be already sent.
                    MessageBox.success("Requisition Sent for Approval!");
                }.bind(this)).catch(function (err) {
                    MessageBox.error("Error updating status: " + err.message);
                });

                // Force a refresh or simply manually handle message if auto-sync
                if (this.getView().getModel().hasPendingChanges()) {
                    this.getView().getModel().submitBatch("updateGroup");
                } else {
                    MessageBox.success("Requisition Sent for Approval!");
                }
            }
        });
    }
);
