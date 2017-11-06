/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * Ship Complete Project: Gap 181 Phase 2 - Set Create Fulfillment Order Flag
 * Author: KCHANG 
 * Last Modified: 9/19/2017
 */
define(['N/search', 'N/record', 'N/email', 'N/runtime', 'N/error', 'N/format', '../NLS_Library_SS2.0/NLS_MR_LIB'],
/**
 * @param {record} record
 * @param {search} search
 */
function(search, record, email, runtime, error, format, lib) {
	var scriptID = runtime.getCurrentScript().getParameter("custscript_nls_updateso_script");
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
    	// Search on Sales Order - Pending Fulfillment.
    	// Saved Search Name: NLS inflight ship Comp so, ID=customsearch_nls_inflight_shipcomp    	
    	var scriptObj = runtime.getCurrentScript();
    	try{	    	
	    	var searchId = scriptObj.getParameter("custscript_nls_ss_shipcomp_dir");
	    	var soSearch = search.load({
	            id: searchId
	        });
	    	var searchResultCount = soSearch.runPaged().count;
	    	
	    	log.audit({
	        	title: "getInputData",
	            details: 'ShipComp searchId:' + searchId + ', Search Result Count=' + searchResultCount
	    	});
	    	return soSearch;
    	}
   	 	catch(e)
        {
//   	 		var emailTo = scriptObj.getParameter("custscript_nls_mr_createfo_email");
//            lib.handleErrorAndSendNotification(e, 'getInputData', emailTo);
            throw error.create({
                name: "MapReduce - getInputData",
                message: 'An error occurred:\n' + 'Error code: ' + e.name + '\n' + 'Error msg: ' + e.message
            });
        }
    }
    
    function map(context){
    	var schResult = JSON.parse(context.value);
//    	log.debug("Map1 schResult.id= " + schResult.id, context.value);
    	var soID = schResult.values.tranid;
    	var statusRef = schResult.values.statusref.value;
    	
    	var id = record.submitFields({
		    type: record.Type.SALES_ORDER,
		    id: schResult.id,
		    values: {
		    	custbody_nls_settle_complete: true,
		    	shipcomplete: false
		    },
		    options: {
		        enableSourcing: false,
		        ignoreMandatoryFields : true
		    }
		});

    	log.debug("SO Ship/Settle Updated", soID + ' ' + statusRef);
    	var objReduce = new Object();
    	objReduce.Error = "";
    	objReduce.tranID = soID;
    	if (id){
    		objReduce.iCount = 1;
    	} else {
    		objReduce.Error = "Sales order update Failed: " + soID;
    	}
    	context.write({
    		key   : id,
    		value : objReduce
    	});
    }

    function reduce(context){
//    	var objReduce = JSON.parse(context.values[0]);
    	var objSummary = JSON.parse(context.values[0]);
    	// Write to Summary output
    	context.write(context.key, objSummary);
    }
    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {
    	var type = summary.toString();
    	var scriptObj = runtime.getCurrentScript();
//    	var emailTo = scriptObj.getParameter("custscript_nls_mr_createfo_email");
    	log.debug({
    		title: type,
    		details: 'Usage Consumed: ' + summary.usage + ' Number of Queues: ' + summary.concurrency + ' Number of Yields: ' + summary.yields
    	});
    	
    	var sName = "SUM-UpdateShipComp ";    	
//        lib.handleErrorIfAny(summary, sName, emailTo);
//        
//        // Write to Summary?        
//    	var WriteSummary = scriptObj.getParameter("custscript_nls_mr_write_summary");    	
//        
//        if (WriteSummary){
//        	// ScriptID
//	        var scriptID = ScriptID;
	        lib.createSummaryRecord(summary, sName, scriptID);
//        }
    }
  
    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize,
        config:{
            exitOnError: false
        }
    };
    
});
