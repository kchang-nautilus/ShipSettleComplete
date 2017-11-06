/**
 * @NApiVersion 2.x
 * @NScriptType MassUpdateScript
 * @NModuleScope SameAccount
 * Update Sales Order Settle Complete and ship complete fields
 */
define(['N/record', 'N/search'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search) {
    
    /**
     * Definition of Mass Update trigger point.
     *
     * @param {Object} params
     * @param {string} params.type - Record type of the record being processed by the mass update
     * @param {number} params.id - ID of the record being processed by the mass update
     *
     * @since 2016.1
     */
    function each(params) {
    	// Update Sales Order Settle Complete and Ship Complete
    	// Save Record: Custom records: 4 usage units		
//    	var recSO = record.load({
//            type: params.type,
//            id: params.id
//        });
//    	recSO.setValue('custbody_nls_settle_complete', true);
//    	recSO.setValue('shipcomplete', false);
//    	recSO.save();
    	
    	// SubmitFields: Custom records: 2 usage units
    	var id = record.submitFields({
		    type: params.type,
		    id: params.id,
		    values: {
		    	custbody_nls_settle_complete: true,
		    	shipcomplete: false
		    },
		    options: {
		        enableSourcing: false,
		        ignoreMandatoryFields : true
		    }
		});
    	log.debug({
    		title: 'massUpdate_SettleCompleteUpdate',
    		details: "Updated Sales Order, params.id" + params.id + " params.type=" + params.type
    	});
    }

    return {
        each: each
    };
    
});
