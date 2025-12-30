sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, UIComponent, JSONModel, History) {
        "use strict";

        return Controller.extend("com.procurement.ui.controller.VendorSelection", {
            onInit: function () {
                var oViewModel = new JSONModel({
                    vendorSelected: true, // Default to true since radio button 1 is selected by default
                    selectedVendorId: "A"
                });
                this.getView().setModel(oViewModel, "view");

                var oChatModel = new JSONModel({
                    messages: []
                });
                this.getView().setModel(oChatModel, "chat");
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

            onVendorSelect: function (oEvent) {
                var iIndex = oEvent.getParameter("selectedIndex");
                var sVendorId = iIndex === 0 ? "A" : "B";
                this.getView().getModel("view").setProperty("/selectedVendorId", sVendorId);
                this.getView().getModel("view").setProperty("/vendorSelected", true);
            },

            onProceed: function () {
                var sVendorId = this.getView().getModel("view").getProperty("/selectedVendorId");
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("RouteCatalog", {
                    vendorId: sVendorId
                });
            },

            onAskAI: function () {
                var oInput = this.byId("chatInput");
                var sValue = oInput.getValue();
                if (!sValue) return;

                // Add User Message
                this._addMessage("User", sValue, "sap-icon://employee");

                // Mock AI Logic
                var sResponse = "";
                var sLower = sValue.toLowerCase();
                if (sLower.includes("laptop") || sLower.includes("computer")) {
                    sResponse = "I recommend Vendor A (Tech Specialist). They have high-performance laptops in stock.";
                } else if (sLower.includes("chair") || sLower.includes("desk") || sLower.includes("furniture")) {
                    sResponse = "For office furniture, Vendor B is your best bet. Check out their ergonomic chairs.";
                } else if (sLower.includes("service") || sLower.includes("custom")) {
                    sResponse = "This item seems unavailable in standard catalogs. Please use the 'Manual Procurement' option from the home page.";
                } else {
                    sResponse = "I'm not sure about that. Please try searching for 'laptop', 'chair', or 'custom'.";
                }

                // Add AI Message (delayed)
                setTimeout(function () {
                    this._addMessage("AI Helper", sResponse, "sap-icon://it-host");
                }.bind(this), 500);

                oInput.setValue("");
            },

            _addMessage: function (sSender, sText, sIcon) {
                var oChatModel = this.getView().getModel("chat");
                var aMessages = oChatModel.getProperty("/messages");
                aMessages.push({
                    sender: sSender,
                    text: sText,
                    timestamp: new Date().toLocaleTimeString(),
                    icon: sIcon
                });
                oChatModel.setProperty("/messages", aMessages);
            }
        });
    }
);
