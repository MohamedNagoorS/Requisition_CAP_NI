sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * Formats the status state (color).
         * @param {string} sStatus
         * @returns {sap.ui.core.ValueState}
         */
        formatStatusState: function (sStatus) {
            switch (sStatus) {
                case "Approved":
                    return "Success";
                case "Rejected":
                    return "Error";
                case "Pending Approval":
                    return "Warning";
                case "Created":
                    return "Information";
                default:
                    return "None";
            }
        },

        /**
         * Formats the status text to include an icon if desired, or just returns text.
         * For ObjectStatus "icon" property.
         * @param {string} sStatus
         * @returns {string}
         */
        formatStatusIcon: function (sStatus) {
            switch (sStatus) {
                case "Approved":
                    return "sap-icon://accept";
                case "Rejected":
                    return "sap-icon://decline";
                case "Pending Approval":
                    return "sap-icon://pending";
                case "Created":
                    return "sap-icon://create";
                default:
                    return "";
            }
        }
    };
});
