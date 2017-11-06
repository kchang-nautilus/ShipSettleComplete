/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * Billing Sales Order = Create Invoice or Cash Sales for Pending Billing Sales Orders
 * Author: KCHANG
 * DF-12606: Rev Rec script created a Cash Sale for a partially fulfilled Settle Complete order
 * Last Modified: 11/3/2017
 */
define(['N/error', 'N/format', 'N/email', 'N/record', 'N/runtime', 'N/search', '../NLS_Library_SS2.0/NLS_MR_LIB'],
/**
 * @param {error} error
 * @param {format} format
 * @param {record} record
 * @param {runtime} runtime
 * @param {search} search
 */
function(error, format, email, record, runtime, search, lib) {
//	var ScriptID = '2014';
	//"statusref":{"value":"pendingBilling","text":"Pending Billing"}
	//"statusref":{"value":"pendingBillingPartFulfilled","text":"Pending Billing/Partially Fulfilled"}
	var PENDING_BILLING = 'pendingBilling';
	var PENDING_BILLING_PARTIALLY_FULFILLED = 'pendingBillingPartFulfilled';
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
    	//Saved Search: Gap 94 Rev Recog All Payments (Existing Catch All saved search)
    	//Saved Search ID: customsearch_nls_rev_rec_all_pay
    	// New Saved Search: NLS MR Pending Billing SO, ID= customsearch_nls_mr_pend_bill_so
    	var scriptObj = runtime.getCurrentScript();
    	try{
			// var billSOSearch = search.load({
			//		id: 'customsearch_nls_mr_pend_bill_so'
			//	});		    	
	    	
	    	var searchId = scriptObj.getParameter("custscript_nls_billso_ssid");
	    	
	    	var billSOSearch = search.load({
	            id: searchId
	        });
	    	var searchResultCount = billSOSearch.runPaged().count;
	    	
	    	log.audit({
	        	title: "getInputData",
	            details: 'Pending Billing SO searchId:' + searchId + ', Search Result Count=' + searchResultCount
	    	});
	    	
	    	return billSOSearch;
    	}
   	 	catch(e)
        {
   	 		var emailTo = scriptObj.getParameter("custscript_nls_mr_billso_email");
            lib.handleErrorAndSendNotification(e, 'getInputData', emailTo);
            throw error.create({
                name: "MapReduce - getInputData",
                message: 'An error occurred:\n' + 'Error code: ' + e.name + '\n' + 'Error msg: ' + e.message
            });
        }    	 		
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
    	log.debug("Map - Billing Sales Order", context.value);
    	//{"recordType":"salesorder","id":"40813789","values":{"trandate":"1/10/2017","internalid":{"value":"40813789","text":"40813789"},"tranid":"SO-71962330","entity":{"value":"61041684","text":"CUS-170109866 BRAD MOGFORD"},"paymentmethod":{"value":"14","text":"Financing"},"custbody_deferred_billing":"F","amount":"2704.09","statusref":{"value":"pendingBillingPartFulfilled","text":"Pending Billing/Partially Fulfilled"},"shipcomplete":"T","custbody_nls_channel":{"value":"1","text":"Direct"},"subsidiary":{"value":"1","text":"Nautilus, Inc."},"total":"2704.09","custbody_nls_payment_method":{"value":"6","text":"Financing"},"custbody_nls_financing_company":{"value":"112","text":"CareCredit"},"custbody_nls_settle_complete":"F"}}
    	// Array has [] and true/false instead of "T" or "F"
    	//{"recordType":"salesorder","id":"39752002","values":{"trandate":"5/24/2017","internalid":[{"value":"39752002","text":"39752002"}],"tranid":"SO-71925684","entity":[{"value":"58323530","text":"CUS-170009342 ANTHONY MALEWICH"}],"paymentmethod":[{"value":"18","text":"VISA"}],"custbody_nls_payment_method":[{"value":"3","text":"Credit Card"}],"custbody_deferred_billing":false,"amount":"118.66","statusref":[{"value":"pendingApproval","text":"Pending Approval"}],"shipcomplete":false,"custbody_nls_channel":[{"value":"1","text":"Direct"}],"subsidiary":[{"value":"1","text":"Nautilus, Inc."}],"total":"118.66","custbody_nls_financing_company":[],"custbody_nls_settle_complete":false}}
    	//{"recordType":"salesorder","id":"39788004","values":{"trandate":"8/25/2017","internalid":{"value":"39788004","text":"39788004"},"tranid":"SO-71926462","entity":{"value":"59940274","text":"CUS-170064896 Valentine Uriah"},"paymentmethod":{"value":"18","text":"VISA"},"custbody_nls_payment_method":{"value":"3","text":"Credit Card"},"custbody_deferred_billing":"F","amount":"1857.99","statusref":{"value":"pendingFulfillment","text":"Pending Fulfillment"},"shipcomplete":"F","custbody_nls_channel":{"value":"1","text":"Direct"},"subsidiary":{"value":"1","text":"Nautilus, Inc."},"total":"1857.99","custbody_nls_financing_company":"","custbody_nls_settle_complete":"F"}}
    	try{    		
	    	var oriValue = context.value;	    	
	    	var searchResult = JSON.parse(oriValue);
	    	
	    	var soID = searchResult.id;	    	
//	    	var soID = searchResult.values.internalid.value;
	    	var tranID = searchResult.values.tranid;
	    	// dir Settle Complete
	    	var settleComp = searchResult.values.custbody_nls_settle_complete;
	    	// Ship Complete
	    	var shipComp = searchResult.values.shipcomplete;	    	
	    	// Order Status
	    	var sStatus = searchResult.values.statusref.value;
	    	//Payment Method = custom pMethod
	    	var pMethod = searchResult.values.custbody_nls_payment_method.value;
	    	//Payment Type = paymentmethod
	    	var pPayMethod = searchResult.values.paymentmethod.value;
	    	var hChannel = searchResult.values.custbody_nls_channel.value;
	    	var deferBill = searchResult.values.custbody_deferred_billing;
	    	var fAmount = searchResult.values.amount;
	    	var fTotal = searchResult.values.total;
//	    	var iCountItem = parseInt(searchResult.values.item);
	    	var hSubsidiary = searchResult.values.subsidiary.value;
	    	var financingCo = searchResult.values.custbody_nls_financing_company.value;
	    	
	    	var bOK = false;
	    	var createBill = false;
	    	var iItemFulfilled = 0;
	    	// Reduce Value
	    	var objReduce = new Object();
	    	//*0. Sales Order ID: tranID
	    	if (soID && tranID){
	    		bOK = true;
	    		objReduce.internalid = soID;
	    		objReduce.tranID = tranID;
	    		objReduce.datecreated = searchResult.values.trandate;
	    		objReduce.customer = searchResult.values.entity.value;
	    		objReduce.subsidiary = hSubsidiary;
	    		objReduce.financingCo = financingCo;
	    		objReduce.iChannel = hChannel;	    		
	    		objReduce.settleComplete = false;
	    		objReduce.shipComplete = false;
	    		objReduce.bDeferBill = false;
	    		objReduce.totalamount = fAmount;
	    		objReduce.status = sStatus;
	    		objReduce.payMethod = '';
	    		objReduce.iCount = 0;
	    		
	    		if (pMethod){
	    			objReduce.payMethod = pMethod;
	    		}
	    		objReduce.payType = '';
	    		if (pPayMethod){
	    			objReduce.payType = pPayMethod;
	    		}
	    		objReduce.bBilling = false;
	    		objReduce.Error = "";
	    		
		    	log.debug({
		    		title: "Map CreateFO searchResult.id=" + searchResult.id,
		    		details: "soID=" + soID + ", tranID=" + tranID + ", hSubsidiary=" + hSubsidiary + ", settleComp=" + settleComp + ", pMethod=" + pMethod 
		    		+ ", hChannel=" + hChannel + ", deferBill=" + deferBill + ", pPayMethod=" + pPayMethod + ", customer=" + objReduce.customer 
		    		+ ", sStatus=" + sStatus + ", financingCo=" + financingCo + ", shipComp=" + shipComp
		    	});		    	
				
				if (sStatus == PENDING_BILLING || sStatus == PENDING_BILLING_PARTIALLY_FULFILLED){
					// Settle Complete?
					if (settleComp === 'T'){
						objReduce.settleComplete = true;	
					}
					if (shipComp === 'T'){
						objReduce.shipComplete = true;
					}
					// SearchShipIF - Add Filter Status = Shipped
//					iItemFulfilled = SearchItemFulfillment(soID);
					iItemFulfilled = SearchShipIF(soID);
					
					if (deferBill === 'T'){
						// Retail ONLY
						objReduce.bDeferBill = true;
						
						if (sStatus == PENDING_BILLING || (sStatus == PENDING_BILLING_PARTIALLY_FULFILLED && settleComp == 'F' && shipComp != 'T')) {						
	//						log.debug({
	//				    		title: "Map SearchItemFulfillment",
	//				    		details: "Has IF, tranID=" + tranID + ", iItemFulfilled=" + iItemFulfilled + ", settleComp=" + settleComp + ", pMethod=" + pMethod +
	//				    		", deferBill=" + deferBill + ", pPayMethod=" + pPayMethod + ", sStatus=" + sStatus + ", financingCo=" + financingCo + ", shipComp=" + shipComp
	//				    	});
							if (iItemFulfilled > 0){
								createBill = true;
							} else {
								objReduce.Error = tranID + " has no Item Fulfillment record found";
							}
						} else {
							objReduce.Error = tranID + " not ready to bill " + ", settle Compl=" + settleComp + ", Status=" + sStatus + ", deferBill=" + deferBill;	
						}						
						
					} else {					
						if (sStatus == PENDING_BILLING_PARTIALLY_FULFILLED && settleComp == 'T') {
		                    createBill = false;
		                    objReduce.Error = tranID + " not ready to bill " + ", Status=" + sStatus + ", settle Compl=" + settleComp + ", deferBill=" + deferBill;
		                } else {
		                	createBill = true;
		                }
					}
				} else {
					createBill = false;
                    objReduce.Error = tranID + " Invalid Order Status: " + sStatus + ", settle Compl=" + settleComp + ", deferBill=" + deferBill;
				}
	    	} else {
	    		objReduce.Error = "Invalid Sale Order soID=" + soID + ", tranID=" + tranID;
	    	}
	    	
	    	//*** Map Flag to Bill ***
	   		objReduce.bBilling = createBill;
	   		objReduce.iCount = iItemFulfilled;
	   		//*** Write order to Context to Reduce: 
	   		log.debug({
	    		title: "map Billing SO? createBill=" + createBill,
	    		details: "Pass to Reduce: soID=" + soID + ", tranID=" + tranID + ", iItemFulfilled=" + iItemFulfilled + ", Settle Comp=" + objReduce.settleComplete + ", sStatus=" + sStatus + ", objReduce.Error=" + objReduce.Error
	    	});	
	   		//objReduce: tranID, iCount, bShipComp, Error
			context.write({
	    		key   : soID,
	    		value : objReduce
	    	});
    	}
        catch(e)
        {
        	var scriptObj = runtime.getCurrentScript();
        	var emailTo = scriptObj.getParameter("custscript_nls_mr_billso_email");
            lib.handleErrorAndSendNotification(e, 'Map', emailTo);
            throw error.create({
                name: "MapReduce - map",
                message: 'Map Error occurred: Error code: ' + e.name + ' Error msg: ' + e.message
            });
        }
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {
    	var objReduce = JSON.parse(context.values[0]);
    	var soID = context.key;
    	var objSummary = new Object();
    	var sSubType = '';
    	var sErrorType = '';
		
		var iNewBill;
		/*
		 * objReduce.internalid;	objReduce.tranID; 	objReduce.datecreated; 	objReduce.customer;  objReduce.financingCo;	 objReduce.subsidiary;
		 * objReduce.iChannel; objReduce.settleComplete; 	objReduce.shipComplete;  objReduce.bDeferBill; 	objReduce.totalamount;
		 * objReduce.status; objReduce.payMethod; 	objReduce.payType;	objReduce.bBilling;	objReduce.Error;
		 */    		
		try{
	    	if (soID && objReduce){
	        	var tranID = objReduce.tranID;	    		
		    	if (tranID){
		    		log.debug({
		    			title: "Reduce RevRec context.key=" + context.key,
		    			details: "tranID=" + tranID + ", objReduce.customer=" + objReduce.customer + ", totalamount=" + objReduce.totalamount + ", status=" + objReduce.status
		    					+ ", objReduce.iChannel=" + objReduce.iChannel + ", objReduce.Error=" + objReduce.Error	+ ", objReduce.financingCo=" + objReduce.financingCo 		
		    		});		    	
			    	
			    	if (!objReduce.Error){
//			    		log.debug({
//			        		title: "reduce - objReduce.bBilling=" + objReduce.bBilling,
//			        		details: "Rev Rec No Error, objReduce.tranID=" + objReduce.tranID + " objReduce.bDeferBill=" + objReduce.bDeferBill + " objReduce.settleComplete=" + objReduce.settleComplete
//			        		+ ", objReduce.payMethod=" + objReduce.payMethod + ", objReduce.payType=" + objReduce.payType
//			        	});
			    		//*** Transform SO and Create CS or INV ***
				    	if (objReduce.bBilling){
				    		sSubType = 'Transform Record'; 
				    		// Invoice or Cash Sale?
				    		objReduce.billType = "CS";
				    		var ToType = record.Type.CASH_SALE;
				    		if (!objReduce.payType){
				    			ToType = record.Type.INVOICE;
				    			objReduce.billType = "INV";
				    		}
				    		
				    		var objRecord = record.transform({
				    		    fromType: record.Type.SALES_ORDER,
				    		    fromId: soID,
				    		    toType: ToType
				    		});
				    		if (objRecord){
				    			sSubType = 'Submit Record';
				    			iNewBill = objRecord.save();
				    			if (iNewBill){			
				    				// ONLY if Invoice or Cash Sales is created.
				    				objReduce.newID = iNewBill;
				    				log.audit({
						        		title: "Billed Successfully iNewBill=" + iNewBill,
						        		details: "Created ToType=" + ToType + " from objReduce.tranID=" + objReduce.tranID + " objReduce.newID=" + objReduce.newID
						        	});
				    			} else {
				    				objReduce.Error = objReduce.tranID + " Failed at " + sSubType + " " + ToType;
				    				WriteToRevRecogError(objReduce, sSubType);
				    			}
				    		} else {
				    			objReduce.Error = objReduce.tranID + " Failed at " + sSubType + " to " + ToType;
				    			WriteToRevRecogError(objReduce, sSubType);
				    		}
				    	} else {
				    		objReduce.Error = objReduce.tranID + " failed Rev Rec: Settle Complete=" + objReduce.settleComplete + ", Defered Billing = " + objReduce.bDeferBill;
				    		log.error({
				        		title: "reduce - objReduce.bBilling" + objReduce.bBilling,
				        		details: "objReduce.tranID=" + objReduce.tranID + " objReduce.bDeferBill=" + objReduce.bDeferBill + ", objReduce.settleComplete=" + objReduce.settleComplete
				        	});
				    	}
				    	//*** Transform SO and Create CS or INV ***
			    	} // objReduce.Error?
		    	}
		    	// Write to Summary output
		    	/*
				 * objReduce.internalid;	objReduce.tranID; 	objReduce.datecreated; 	objReduce.customer;  objReduce.financingCo;	 objReduce.subsidiary;
				 * objReduce.iChannel; objReduce.settleComplete; 	objReduce.shipComplete;  objReduce.bDeferBill; 	objReduce.totalamount;
				 * objReduce.status; objReduce.payMethod; 	objReduce.payType;	objReduce.bBilling;	objReduce.Error;
				 * NEW Fields: objReduce.payType; objReduce.billType; objReduce.newID
				 */
		    	objSummary = objReduce;
		    	// Reduce Key changed to CS or INV internal ID
		    	var reduceKey = soID;
		    	if (iNewBill){
		    		reduceKey = iNewBill;
		    	}
		    	
		    	context.write(reduceKey, objSummary);
	    	}	    	
    	}
		catch(e)
	    {
			sErrorType = e.name;
			objReduce.Error = objReduce.tranID + " Failed Rev Rec Error Code=" + e.name + ", " + e.message;
			WriteToRevRecogError(objReduce, sErrorType);
//	        lib.handleErrorAndSendNotification(e, 'Reduce');
			throw error.create({
                name: "MapReduce - reduce",
                message: "Error occurred: tranID=" + tranID + " Error Code: " + e.name + ", " + e.message
            });
	    }
		
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
    	var emailTo = scriptObj.getParameter("custscript_nls_mr_billso_email");
    	log.debug({
    		title: type,
    		details: 'Usage Consumed: ' + summary.usage + ' Number of Queues: ' + summary.concurrency + ' Number of Yields: ' + summary.yields
    	});
    	
    	lib.handleErrorIfAny(summary, sName, emailTo);
    	
    	var sName = "SUM-94 ";
        var scriptID = scriptObj.getParameter("custscript_nls_bill_script_internalid");;
        
        // Write to Summary?  // custscript_nls_mr_log_summary
        
    	var WriteSummary = scriptObj.getParameter("custscript_nls_mr_log_summary");    	
        
        if (WriteSummary){        	
        	lib.createSummaryRecord(summary, sName, scriptID);
        }
    }

    function getLargeRecord(){
    	//*** NO NEED to GetRange to return more than 1,000 ***
//    	var billSOSearch = search.load({
//            id: searchId
//        });
//    	var searchResultCount = billSOSearch.runPaged().count;
//    	var oResults = new Array();
//    	var shResult;
//    	var arrIndex = searchResultCount;
//    	var iEnd = 1000;
//		var iStart = 0;
//		if (iEnd > arrIndex){
//			iEnd = arrIndex;
//		}
//		//The start parameter is the inclusive index of the first result to return. 
//		//The end parameter is the exclusive index of the last result to return. 
//		//For example, getRange(0, 10) retrieves 10 search results, at index 0 through index 9. 
//		//Unlimited rows in the result are supported, however you can only return 1,000 at a time based on the index values.
//		if (iEnd < iStart){
//			iEnd = iStart;
//		}			
//
//		while (iEnd <= searchResultCount && iEnd > iStart) {
//			
//    		shResult = billSOSearch.run().getRange({
//            	start: iStart,
//            	end: iEnd
//            });
//    		for (var iSO = 0; iSO < shResult.length; iSO++) {
//	    		var result = shResult[iSO];
//	    		oResults.push(result);
//    		}		    	
//	    	
//	    	iStart = iEnd;
//	    	var iRem = searchResultCount - iStart;
//	    	
//	    	if (iRem > 1000){
//	    		iEnd = iStart + 1000;
//	    	} else {
//    			if (iRem > 0){
//	    			iEnd = iStart + iRem;
//    			}
//	    	}		    	
//		}
//		
//        log.audit({
//        	title: "getInputData",
//            details: 'Pending Billing SO searchId:' + searchId + ', Search Result Count=' + searchResultCount + " results.length=" + oResults.length
//        });
//        
//    	return oResults;  
    }
    
    function SearchItemFulfillment(soID){
    	// Saved Search: SO Item Fulfillment Rec
    	// Search ID: customsearch_nls_billing_so_if
    	var iResult = 0;
    	var itemfulfillmentSearchObj = search.create({
    		   type: "itemfulfillment",
    		   filters: [
    		      ["type","anyof","ItemShip"], 
    		      "AND", 
    		      ["item.type","anyof","InvtPart","Kit"], 
    		      "AND", 
    		      ["createdfrom.internalidnumber","equalto", soID], 
    		      "AND", 
    		      ["appliedtotransaction.internalidnumber","isnotempty",""]
    		   ],
    		   columns: [
    		      search.createColumn({
    		         name: "trandate",
    		         sort: search.Sort.ASC
    		      }),
    		      search.createColumn({
    		         name: "tranid",
    		         sort: search.Sort.ASC
    		      }),
    		      "entity",
    		      "statusref",
    		      "createdfrom",
    		      "item",
    		      "quantity",
    		      "appliedtotransaction"
    		   ]
    		});
		var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
		itemfulfillmentSearchObj.run().each(function(result){
		   // .run().each has a limit of 4,000 results
			iResult++;
			return true;
		});
    	return searchResultCount;
    }
    
    function SearchShipIF(soID){
    	// Status = ItemFulfillment: Shipped
    	var iResult = 0;
    	var itemfulfillmentSearchObj = search.create({
    		   type: "itemfulfillment",
    		   filters: [
    		      ["type","anyof","ItemShip"], 
    		      "AND", 
    		      ["status","anyof","ItemShip:C"], 
    		      "AND", 
//    		      ["custcol_nls_item_type_po","anyof","6","1"],
    		      ["item.type","anyof","Kit","InvtPart"],
    		      "AND", 
    		      ["createdfrom.internalidnumber","equalto",soID], 
    		      "AND", 
    		      ["appliedtotransaction.internalidnumber","isnotempty",""]
    		   ],
    		   columns: [
    		      search.createColumn({
    		         name: "trandate",
    		         sort: search.Sort.ASC
    		      }),
    		      "type",
    		      "createdfrom",
    		      "internalid",
    		      search.createColumn({
    		         name: "tranid",
    		         sort: search.Sort.ASC
    		      }),
    		      "entity",
    		      "statusref",
    		      "item",
    		      "quantity",
    		      "appliedtotransaction"
    		   ]
    		});
    		var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
    		itemfulfillmentSearchObj.run().each(function(result){
    		   // .run().each has a limit of 4,000 results
    			iResult++;
    		   return true;
    		});
    	return searchResultCount;
    }
    function WriteToRevRecogError(objSO, sErrorType)
    {
    	// Custom Record: Rev Recog Script Errors, ID=customrecord_gap94_rev_rec_errors
    	var stLoggerTitle = 'WriteToRevRecogError';	
    	/*
		 * objSO.internalid; objSO.tranID; objSO.datecreated; objSO.customer; objSO.financingCo;	 objSO.subsidiary;
		 * objSO.iChannel; objSO.settleComplete; objSO.shipComplete; objSO.bDeferBill; objSO.totalamount;
		 * objSO.status; objSO.payMethod; objSO.payType; objSO.bBilling; objSO.Error;
		 */
    	try {
//    		var recRevRecError = nlapiCreateRecord('customrecord_gap94_rev_rec_errors');
    		var rec = record.create({
                type: 'customrecord_gap94_rev_rec_errors',
                isDynamic: false
            });
    		rec.setValue({
                fieldId : 'name',
                value: "RR-" + objSO.tranID
            });
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_internalid', rcdLineItem.getValue('internalid'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_internalid',
                value: objSO.internalid
            });
//    	    recRevRecError.setFieldValue('custrecord_nls_rev_rec_order_date', rcdLineItem.getValue('datecreated'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_order_date',
                value: objSO.datecreated
            });
//    	    recRevRecError.setFieldValue('custrecord_nls_rev_rec_so_id', rcdLineItem.getValue('internalid'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_so_id',
                value: objSO.internalid
            });
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_customer', rcdLineItem.getValue('name'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_customer',
                value: objSO.customer
            });
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_subsidiary', rcdLineItem.getText('subsidiary'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_subsidiary',
                value: objSO.subsidiary
            });
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_shipcomplete', rcdLineItem.getValue('shipcomplete'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_shipcomplete',
                value: objSO.settleComplete
            });
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_status', rcdLineItem.getText('statusref'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_status',
                value: objSO.status
            });
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_amount', rcdLineItem.getValue('totalamount'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_amount',
                value: objSO.totalamount
            });
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_channel', rcdLineItem.getText('custbody_nls_channel'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_channel',
                value: objSO.iChannel
            });
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_financing_company', rcdLineItem.getText('custbody_nls_financing_company'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_financing_company',
                value: objSO.financingCo
            });
//    		//Payment Method = custbody_nls_payment_method
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_pay_method', rcdLineItem.getText('custbody_nls_payment_method'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_pay_method',
                value: objSO.payMethod
            });
//    		//Payment Type = paymentmethod
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_payment_type', rcdLineItem.getText('paymentmethod'));
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_payment_type',
                value: objSO.payType
            });
//    	    // Error Detail: custrecord_nls_rev_rec_error_msg
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_error_msg', sErrorMsg);
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_error_msg',
                value: objSO.Error
            });
//    		// Error Type: custrecord_nls_rev_rec_error_type
//    		recRevRecError.setFieldValue('custrecord_nls_rev_rec_error_type', sErrorType);
    		rec.setValue({
                fieldId : 'custrecord_nls_rev_rec_error_type',
                value: sErrorType
            });
//    	    var iLog = nlapiSubmitRecord(recRevRecError, false, true);
    		var iLog = rec.save();
            log.debug({
    			title: 'Rec.save_' + stLoggerTitle,
    			details: "Rev Recog Error Report created. iLog=" + iLog + ", objSO.tranID=" + objSO.tranID
    		});
    	} catch (e) {
    		var sError = 'Exception caught in Try/Catch block [' + stLoggerTitle + '], Error Details:' + e.toString();
//    		nlapiLogExecution('Error', stLoggerTitle, sError);
    		 log.error({
     			title: "UNKNOWN_ERROR " + stLoggerTitle,
     			details: sError
     		});
    	}
    }
    // exitOnError: true in Testing ONLY?
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
