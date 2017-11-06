/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * Ship Complete Project: Gap 181 Phase 2 - Set Create Fulfillment Order Flag
 * Author: KCHANG 
 * Last Modified: 9/1/2017
 */
define(['N/search', 'N/record', 'N/email', 'N/runtime', 'N/error', 'N/format', '../NLS_Library_SS2.0/NLS_MR_LIB'],
/**
 * @param {record} record
 * @param {search} search
 */
function(search, record, email, runtime, error, format, lib) {
	//TESTING ONLY: TAX AMOUNT : custcol_stxtaxamount
//	var taxAmountValue = "i-0";	
	// Script ID: NLS MR SO Create Fulfill Order
	// Sandbox 2 = 2013 
//	var ScriptID = '2013';	
	// EXCLUDE Warranty and Intercompany order	
//	var DepRetailWarranty = '86';	
	var DepRetailWarranty = runtime.getCurrentScript().getParameter('custscript_nls_fo_excl_dept');
	// Inter Company Order : Customer Category = Intercompany
//	var InterCoCustCategory = '52';
	var InterCoCustCategory = runtime.getCurrentScript().getParameter('custscript_nls_excl_cust_category');
	// Request Date
	var maxReqDate = 7;
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
    	// Saved Search Name: NLS MR Set Fulfill Orderline, ID= customsearch_nls_mr_set_fulfill_order
    	// ALL Lines - Testing NLS MR Set Fulfill Orderline Line, ID= customsearch_nls_mr_set_fulfill_order_2
    	var scriptObj = runtime.getCurrentScript();
    	try{
//	    	var soSearch = search.load({
//	    		id: 'customsearch_nls_mr_set_fulfill_order'
//	    	});    	
	    	
	    	var searchId = scriptObj.getParameter("custscript_nls_foso_ssid");
	    	var soSearch = search.load({
	            id: searchId
	        });
	    	var searchResultCount = soSearch.runPaged().count;
	    	
	    	log.audit({
	        	title: "getInputData",
	            details: 'Pending Fulfillment Create FO searchId:' + searchId + ', Search Result Count=' + searchResultCount
	    	});
	    	return soSearch;
    	}
   	 	catch(e)
        {
   	 		var emailTo = scriptObj.getParameter("custscript_nls_mr_createfo_email");
            lib.handleErrorAndSendNotification(e, 'getInputData', emailTo);
            throw error.create({
                name: "MapReduce - getInputData",
                message: 'An error occurred:\n' + 'Error code: ' + e.name + '\n' + 'Error msg: ' + e.message
            });
        }
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     * Map stage to process NON Ship complete sales order
     * Write sales order to Context to Pass to Reduce stage to process "Ship Complete" sales order
     * Last Modified: 8/23/2017 KCHANG
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
    	// Map stage to process NON Ship complete sales order
    	// Write sales order to Context to Pass to Reduce stage to process "Ship Complete" sales order
    	log.debug("Map - Gap 181.2 Create Fulfill Order", context.value);
    	try{	    	
	    	//* Remove GROUP()
	    	var oriValue = context.value;
	    	var newValue = oriValue.replace("GROUP(internalid)", "internalid").replace("GROUP(department)", "department").replace("GROUP(custbody_nls_channel)", "custbody_nls_channel").replace("GROUP(tranid)", "tranid").replace("GROUP(custbody_nls_finance_auth_code)", "custbody_nls_finance_auth_code").replace("GROUP(shipcomplete)", "shipcomplete").replace("GROUP(custbody_nls_payment_method)", "custbody_nls_payment_method").replace("GROUP(custbody_nls_request_date)", "custbody_nls_request_date").replace("COUNT(item)", "item").replace("GROUP(custbody_nls_sub_channel)", "custbody_nls_sub_channel");
//	    	log.debug("Map - SO FO No GROUP newValue=", newValue);
	    	var searchResult = JSON.parse(newValue);
	    	//{"recordType":"salesorder","id":"43367647","values":{"trandate":"4/2/2017","internalid":{"value":"43367647","text":"43367647"},"tranid":"SO-72038251"}}
	//    	var soID = searchResult.id;
	//    	var tranID = searchResult.values.tranid;
	    	//{"recordType":null,"id":"62","values":{"GROUP(trandate)":"4/3/2017","GROUP(internalid)":{"value":"43368462","text":"43368462"},"GROUP(tranid)":"SO-72038272","GROUP(custbody_nls_channel)":{"value":"1","text":"Direct"},"GROUP(subsidiary)":{"value":"1","text":"Nautilus, Inc."},"GROUP(shipcomplete)":"T","GROUP(paymentmethod)":"","GROUP(custbody_nls_payment_method)":{"value":"6","text":"Financing"},"GROUP(custbody_nls_finance_auth_code)":"1274930","GROUP(custbody_nls_requires_routing)":"F","GROUP(custbody_nls_request_date)":"","COUNT(item)":"1"}}
	    	var soID = searchResult.values.internalid.value;
	    	var tranID = searchResult.values.tranid;
	    	var shipCom = searchResult.values.shipcomplete;
	    	var pMethod = searchResult.values.custbody_nls_payment_method.value;
	    	var hChannel = searchResult.values.custbody_nls_channel.value;
	    	var finAuth = searchResult.values.custbody_nls_finance_auth_code;
	    	var hReqDate = searchResult.values.custbody_nls_request_date;
	    	var iCountItem = parseInt(searchResult.values.item);
	    	var hDepartment = searchResult.values.department.value;
	    	var custCategory = searchResult.values.custbody_nls_sub_channel.value;
	    	
	    	var bOK = false;
	    	// Reduce Value
	    	var objReduce = new Object();
//			var arrItems = new Array();
//			var invCount = 0;
	    	//*0. Sales Order ID: tranID
	    	if (soID && tranID){
	    		bOK = true;
	    		objReduce.tranID = tranID;
	    		// bShipComp for Map? or Reduce?
	    		objReduce.Error = "";	
	    		objReduce.bShipComp = false;
	    		
		    	log.debug({
		    		title: "Map CreateFO searchResult.id=" + searchResult.id,
		    		details: "soID=" + soID + ", tranID=" + tranID + ", hDepartment=" + hDepartment + ", shipCom=" + shipCom + ", pMethod=" + pMethod 
		    		+ ", hChannel=" + hChannel + ", finAuth=" + finAuth + ", hReqDate=" + hReqDate + ", iCountItem=" + iCountItem + ", custCategory=" + custCategory
		    		+ ", DepRetailWarranty=" + DepRetailWarranty + ", InterCoCustCategory=" + InterCoCustCategory
		    	});
	    	} else {
	    		objReduce.Error = "Invalid Sale Order soID=" + soID + ", tranID=" + tranID;
	    	}
	    	//*1. Financing eConsent re-authorized?
			var bFinanceOK = true;
			if (bOK && pMethod == '6' && (!finAuth || finAuth == "- None -")) {
				objReduce.Error = "Financing Order has no Auth Code, map tranID=" + tranID;
				bFinanceOK = false;
			} else {
				bOK = bFinanceOK;
			}
			//*2. Header Request Date???
			if (bOK && hReqDate && hChannel == '2' && hDepartment != DepRetailWarranty && custCategory != InterCoCustCategory){
				bOK = validRequestDate(hReqDate);				
			}
			if (bOK){
				//*3. Search General Hold
				var iHold = searchSOGeneralHolds(soID);
				if (iHold && iHold > 0){
					bOK = false;
					objReduce.Error = "Sales Order has " + iHold + " Hold, tranID=" + tranID;
					log.audit({
			    		title: "map Sale Order Has Hold",
			    		details: "soID=" + soID + ", tranID=" + tranID + ", iHold=" + iHold
			    	});
				}
			} else {
				if (!objReduce.Error){
					objReduce.Error = tranID + " Retail order has invalid header Request Date: " + hReqDate;
				}
			}
			
			//*4. Item Count?
			var bUpdateSO = false;
			if (bOK && iCountItem > 0){
				objReduce.iCount = iCountItem;
				bUpdateSO = true;
			} else {
				objReduce.iCount = 0;
			}
			
	    	if (bUpdateSO){
	    		
				if (shipCom === 'T'){
					objReduce.bShipComp = true;	
				} else {
					objReduce.bShipComp = false;
				}
				
				log.debug({
		    		title: "map Sale Order Ship Complete",
		    		details: "Pass to Reduce: soID=" + soID + ", tranID=" + tranID + ", shipCom=" + shipCom
		    	});			     			
	    	} else {
	    		if (!objReduce.Error){
	    			objReduce.Error = "map Order has Invalid iCountItem=" + iCountItem + ", tranID=" + tranID;
	    		}
	    	}
	   		
	   		//*** Write order to Context to Reduce: 
	   		//objReduce: tranID, iCount, bShipComp, Error, arrItems
			context.write({
	    		key   : soID,
	    		value : objReduce
	    	});
    	}
        catch(e)
        {
        	var scriptObj = runtime.getCurrentScript();
        	var emailTo = scriptObj.getParameter("custscript_nls_mr_createfo_email");
            lib.handleErrorAndSendNotification(e, 'Map', emailTo);
            throw error.create({
                name: "MapReduce - map",
                message: 'An error occurred:\n' + 'Error code: ' + e.name + '\n' + 'Error msg: ' + e.message
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
    	//* objReduce: tranID, iCount, bShipComp, Error, arrItems    	
	    
	    var objReduce = JSON.parse(context.values[0]);
    	var objSummary = new Object();
    	var soID = context.key;
    	
    	try{
    		// Replacing objReduce with objSummary
    		// objSummary: tranID, iCount, bShipComp, Error, arrItems
        	objSummary = objReduce;
	    	if (objReduce){
	    		
	        	var tranID = objReduce.tranID;
	    		//{"tranID":"SO-72038266","Error":"","bShipComp":true,"iCount":2,"arrItems
	    		//context.key=43368462 objReduce={"tranID":"SO-72038272","Error":"","bShipComp":true,"iCount":2,"arrItems":[{"tranID":"SO-72038272","idItem":"8459","lineNo":"1"},{"tranID":"SO-72038272","idItem":"4128","lineNo":"5"}]}, 

		    	if (soID && tranID){
		    		log.debug({
		    			title: "reduce objReduce context.key=" + context.key,
		    			details: "tranID=" + tranID + ", objReduce.iCount=" + objReduce.iCount 
		    					+ ", objReduce.bShipComp=" + objReduce.bShipComp + ", objReduce.Error=" + objReduce.Error	    		
		    		});		    	
			    	
			    	if (!objReduce.Error){
			    		// Resetting objSummary
				    	if (objReduce.bShipComp === true){
				    		objSummary = procShipCompleteOrder(soID);
				    		log.debug({
				        		title: "Reduce - AFTER_procShipCompleteOrder",
				        		details: "YES Ship Complete objSummary.tranID=" + objSummary.tranID + " objSummary.iCount=" + objSummary.iCount
				        	});
				    	} else {
				    		objSummary = procNonShipCompOrders(soID);
				    		log.debug({
				        		title: "Reduce - AFTER_procNonShipCompleteOrder",
				        		details: "NOT Ship Complete objSummary.tranID=" + objSummary.tranID + " objSummary.iCount=" + objSummary.iCount
				        	});
				    	}				    	
			    	} 
		    	} else {
		    		if (!objReduce.Error){
		    			objSummary.Error = "Reduce - Invalid order Id soID=" + soID + ", tranID=" + tranID;
		    		}
		    	}
	    	}
    	}
    	catch(e)
        {
    		objSummary.Error = objSummary.Error + " Unknow Error soID=" + soID + " Error Code: " + e.name + ", " + e.message;
    		var scriptObj = runtime.getCurrentScript();
    		var emailTo = scriptObj.getParameter("custscript_nls_mr_createfo_email");
            lib.handleErrorAndSendNotification(e, 'Reduce', emailTo);
            throw error.create({
                name: "MapReduce - reduce",
                message: 'An error occurred:\n' + 'Error code: ' + e.name + '\n' + 'Error msg: ' + e.message
            });
        }
    	
    	// Write to Summary output    	
    	context.write(soID, objSummary);
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
    	var emailTo = scriptObj.getParameter("custscript_nls_mr_createfo_email");
    	log.debug({
    		title: type,
    		details: 'Usage Consumed: ' + summary.usage + ' Number of Queues: ' + summary.concurrency + ' Number of Yields: ' + summary.yields
    	});
    	
    	var sName = "SUM-181.2 ";    	
        lib.handleErrorIfAny(summary, sName, emailTo);
        
        // Write to Summary?        
    	var WriteSummary = scriptObj.getParameter("custscript_nls_mr_write_summary");    	
        
        if (WriteSummary){
        	// ScriptID
	        var scriptID = scriptObj.getParameter("custscript_nls_fo_script_internalid");
	        lib.createSummaryRecord(summary, sName, scriptID);
        }
    }
  
    function validRequestDate(requestDate){
    	var bOK = false;
    	if (requestDate){
	    	// is on or before 7 days from now
			var reqDate = new Date(requestDate);
			var today = new Date();
			var dateDiff = (today - reqDate)/86400000;
//			var expired = (today.setDate(today.getDate() - maxReqDate))/86400000;
			
			if (dateDiff >= 0 && dateDiff < maxReqDate){
				bOK = true;
			}
    	}
		return bOK;
    }
    
    function procNonShipCompOrders(soID){
    	//*** Process Ship complete orders with multiple line items at Reduce stage
    	var bOK = false;
    	// objSummary: tranID, iCount, bShipComp, Error, arrItems  	
    	var objSummary = new Object();
//    	var arrItems = new Array();    	
    	var invCount = 0;
    	// Initialize objSummary
		objSummary.Error = "";
		objSummary.bShipComp = false;
		
    	if (soID){
    		//*** Load Sales Order ***
			var recSO = record.load({
	    		type: record.Type.SALES_ORDER,
	    		id: soID,
	    		idDynamic: true
	    	});
			if (recSO){
				var itemCount = recSO.getLineCount('item');	
	   			var iChannel = recSO.getValue('custbody_nls_channel');
				var tranID = recSO.getValue('tranid');
				var hDepartment = recSO.getValue('department');
				var shipComplete = recSO.getValue('shipcomplete');
				var custCategory = recSO.getValue('custbody_nls_sub_channel');
				
//				log.debug({
//		    		title: "procNonShipCompOrders soID=" + soID,
//		    		details: "tranID=" + tranID + ", itemCount=" + itemCount + ", iChannel=" + iChannel + ", shipComplete=" + shipComplete + ", hDepartment=" + hDepartment
//		    	});
				
				if (tranID && itemCount > 0){
					objSummary.tranID = tranID;
					bOK = true;	
				}
				var bUpdateSO = bOK;
				
				//*** Item Loop ***
				for (var iLine = 0; iLine < itemCount; iLine++) {
					var idItem = recSO.getSublistValue({
			    		sublistId: 'item',
			    		fieldId: 'item',
			    		line: iLine
			    	});
					var sItem = recSO.getSublistText({
			    		sublistId: 'item',
			    		fieldId: 'item',
			    		line: iLine
			    	});	 
					// Item Type
		    		var stItemType = recSO.getSublistValue({
		        		sublistId: 'item',
		        		fieldId: 'itemtype',
		        		line: iLine
		        	});	 
		    		// Line Number
					var lineNo = recSO.getSublistValue({
		        		sublistId: 'item',
		        		fieldId: 'line',
		        		line: iLine
		        	});	
					// Inventory Item - Fulfillable?
		    		if (stItemType === 'InvtPart' || stItemType === 'Kit') {
		    			// Create Fulfillment Order?
		    			var bCreateFO = recSO.getSublistValue({
		    				sublistId: 'item',
		    				fieldId: 'custcol_create_fulfillment_order',
		    				line: iLine
		    			});
		    			if (bCreateFO === true){
		    				bUpdateSO = false;
//		    				objSummary.Error = tranID + " Create Fulfillment Order = " + createFO + " SKIP lineNo=" + lineNo + ", iLine=" + iLine;
		    			} else {
			    			// BackOrdered?
			    			var intQtyBackOrdered = recSO.getSublistValue({
					    		sublistId: 'item',
					    		fieldId: 'quantitybackordered',
					    		line: iLine
					    	});	 		    		
			    			// Quantity Commit
			    			var iCommit = recSO.getSublistValue({
					    		sublistId: 'item',
					    		fieldId: 'quantitycommitted',
					    		line: iLine
					    	});	 
			    			// Quantity
			    			var iQty = recSO.getSublistValue({
					    		sublistId: 'item',
					    		fieldId: 'quantity',
					    		line: iLine
					    	});	
			    			// Ship Complete to commit all qty
			    			var iUnCommitted = parseInt(iQty) - parseInt(iCommit);
			    			
			    			if (!intQtyBackOrdered){
			    				intQtyBackOrdered = 0;
			    			}	    			
	//						if (!intQtyBackOrdered || intQtyBackOrdered == 0){
							if (intQtyBackOrdered == 0 && iUnCommitted == 0){
								bUpdateSO = true;							
								// Request Date, ID=custcol_nls_request_date, 
								// Exclude Intercompany
	//							if (bOK && hReqDate && hChannel == '2' && hDepartment != depRetailWarranty && custCategory != interCoCustCategory){
								if (iChannel == '2' && hDepartment != DepRetailWarranty && custCategory != InterCoCustCategory){
									var requestDate = recSO.getSublistValue({
										sublistId: 'item',
										fieldId: 'custcol_nls_request_date',
										line: iLine
									});
									if (!requestDate){
										bUpdateSO = false;
										objSummary.Error = tranID + " Retail Order missing Request Date at line #" + lineNo;
									} else {
										// is on or before 7 days from now
										bUpdateSO = validRequestDate(requestDate);
										if (!bUpdateSO){										
											objSummary.Error = tranID + " Retail Order has invalid Request Date at line " + lineNo + ", requestDate=" + requestDate;
										}
									}
								}
								
								if (bUpdateSO){
									invCount ++;
									//* Create Fulfillment Order - checkbox
									recSO.setSublistValue({
										sublistId: 'item',
										fieldId: 'custcol_create_fulfillment_order',
										line: iLine,
										value: true
									});
		
									//*** Testing ONLY: Tax Amount ID= custcol_stxtaxamount
//									recSO.setSublistValue({
//										sublistId: 'item',
//										fieldId: 'custcol_stxtaxamount',
//										line: iLine,
//										value: taxAmountValue
//									});
	//								var objItems = new Object();
	//								objItems.tranID = tranID;
	//								objItems.idItem = idItem;
	//								objItems.lineNo = lineNo;				
	//								arrItems.push(objItems);		
								}
								
							} else {
								bUpdateSO = false;
								objSummary.Error = tranID + " NSC Order has back ordered at line Id:" + lineNo + ", BackOrdered=" + intQtyBackOrdered + ", iUnCommitted=" + iUnCommitted;
							}	
							log.debug({
					    		title: "NSC iLine=" + iLine + ", bUpdateSO=" + bUpdateSO,
					    		details: "tranID=" + tranID + ", idItem=" + idItem + ", sItem=" + sItem + ", shipComplete=" + shipComplete + ", intQtyBackOrdered=" + intQtyBackOrdered + ", lineNo=" + lineNo + ", iUnCommitted=" + iUnCommitted
					    	});						
		    			} // Create Fulfillment Order = True
		    			
		    		}  // Inventory Items	
				} // Item Loop
				
				// *** Save Sales order
				if (invCount > 0){
					// *** Save order
					var updateID = recSO.save({
						enableSourcing: false,
						ignoreMandatoryFields: false
					});			
	
	//				for (var i = 0; i < arrItems.length; i++){
	//		    		var objItem = arrItems[i];	    		
	//		    		log.debug({
	//		        		title: "Updated arrItems i=" + i,
	//		        		details: "objItem.tranID=" + objItem.tranID + " objItem.lineNo=" + objItem.lineNo + ", objItem.idItem=" + objItem.idItem
	//		        	});
	//		    	}
					
		    		log.audit({
			    		title: "NSC Order Updated bUpdateSO=" + bUpdateSO,
			    		details: "tranID=" + tranID + ", invCount=" + invCount + ", soID=" + soID + ", shipComplete=" + shipComplete + ", iChannel=" + iChannel + ", objSummary.Error=" + objSummary.Error
			    	});
	    		} else {
	    			if (!objSummary.Error){
	    				objSummary.Error = "SKIP Sale Order tranID = " + tranID + ", invCount=" + invCount + ", iChannel=" + iChannel + ", shipComp=" + shipComplete + ", bCreateFO=" + bCreateFO;
	    			}
	    			log.audit({
	            		title: "NSC Skip Order bUpdateSO=" + bUpdateSO,
	            		details: "tranID=" + tranID + ", invCount=" + invCount + ", bCreateFO=" + bCreateFO + ", shipComplete=" + shipComplete + ", iChannel=" + iChannel + ", objSummary.Error=" + objSummary.Error
	            	});
	    		}
				// Write to Reduce with order IDs and Item count
				objSummary.iCount = invCount;				
			}
			else {
				objSummary.Error = "Sales Order Not Found soID=" + soID;
			}	
    	} else {
    		objSummary.Error = "Invalid Sales Order Internal ID soID=" + soID;
    	}
    	return objSummary;
    }
    
    function procShipCompleteOrder(soID){
    	//*** Process Ship complete orders with multiple line items at Reduce stage
    	var bOK = false;
    	// objSummary: tranID, iCount, bShipComp, Error, arrItems  	
    	var objSummary = new Object();
//    	var arrItems = new Array();    	
    	var invCount = 0;
    	// Initialize objSummary
		objSummary.Error = "";
		objSummary.bShipComp = false;
		
    	if (soID){
    		//*** Load Sales Order ***
			var recSO = record.load({
	    		type: record.Type.SALES_ORDER,
	    		id: soID,
	    		idDynamic: true
	    	});
			if (recSO){
				bOK = true;			
				var itemCount = recSO.getLineCount('item');
				var iChannel = recSO.getValue('custbody_nls_channel');
				var docNum = recSO.getValue('tranid');
		    	var shipComplete = recSO.getValue('shipcomplete');
		    	var hDepartment = recSO.getValue('department');
		    	var custCategory = recSO.getValue('custbody_nls_sub_channel');
				
//				log.debug({
//		    		title: "procShipCompleteOrder soID=" + soID,
//		    		details: "docNum=" + docNum + ", itemCount=" + itemCount + ", iChannel=" + iChannel + ", shipComplete=" + shipComplete + ", hDepartment=" + hDepartment + ", custCategory=" + custCategory
//		    	});
				
				if (docNum && itemCount > 0){
					objSummary.tranID = docNum;
					objSummary.bShipComp = shipComplete;
					// This should not happen, only ship complete here
					if (!objSummary.bShipComp){
						objSummary.Error = "Sales Order Ship Complete mis-match, reduce docNum=" + docNum + ", ShipComp=" + objSummary.bShipComp;
						bOK = false;
					}
				} else {
					bOK = false;
					objSummary.Error = "Invalid Sales Order " + docNum + ", item Count=" + itemCount;
				}
			} else {
				objSummary.Error = "Sales Order Not Found, reduce soID=" + soID;
			}
			
			var bUpdateSO = bOK;
			if (bUpdateSO && shipComplete){
				
				//*** Item Loop ***			
				for (var iLine = 0; iLine < itemCount; iLine++) {
					if (bUpdateSO || iLine === 0){
						var idItem = recSO.getSublistValue({
				    		sublistId: 'item',
				    		fieldId: 'item',
				    		line: iLine
				    	});	    	
						var sItem = recSO.getSublistText({
				    		sublistId: 'item',
				    		fieldId: 'item',
				    		line: iLine
				    	});	 
						// Item Type
			    		var stItemType = recSO.getSublistValue({
			        		sublistId: 'item',
			        		fieldId: 'itemtype',
			        		line: iLine
			        	});	 
			    		// Line Number
						var lineNo = recSO.getSublistValue({
			        		sublistId: 'item',
			        		fieldId: 'line',
			        		line: iLine
			        	});	
			    		if (stItemType === 'InvtPart' || stItemType === 'Kit') {
			    			// Create Fulfillment Order?
			    			var bCreateFO = recSO.getSublistValue({
			    				sublistId: 'item',
			    				fieldId: 'custcol_create_fulfillment_order',
			    				line: iLine
			    			});
			    			if (bCreateFO === true){
//			    				bUpdateSO = false;
//			    				objSummary.Error = tranID + " Create Fulfillment Order = " + createFO + " SKIP lineNo=" + lineNo + ", iLine=" + iLine;
			    			} else {
				    			// BackOrdered?
			    			
				    			var intQtyBackOrdered = recSO.getSublistValue({
						    		sublistId: 'item',
						    		fieldId: 'quantitybackordered',
						    		line: iLine
						    	});	 
				    			var iCommit = recSO.getSublistValue({
						    		sublistId: 'item',
						    		fieldId: 'quantitycommitted',
						    		line: iLine
						    	});	 
				    			var iQty = recSO.getSublistValue({
						    		sublistId: 'item',
						    		fieldId: 'quantity',
						    		line: iLine
						    	});	
				    			// Ship Complete to commit all qty
				    			var iUnCommitted = parseInt(iQty) - parseInt(iCommit);
				    			
				    			if (!intQtyBackOrdered){
				    				intQtyBackOrdered = 0;
				    			}	    			
				    			
								if (intQtyBackOrdered == 0 && iUnCommitted == 0){								
									// Request Date, ID=custcol_nls_request_date
									// EXCLUDE Warranty and Intercompany order
									if (iChannel == '2' && hDepartment != DepRetailWarranty && custCategory != InterCoCustCategory){
										var requestDate = recSO.getSublistValue({
											sublistId: 'item',
											fieldId: 'custcol_nls_request_date',
											line: iLine
										});
										if (!requestDate){
											bUpdateSO = false;
											objSummary.Error = docNum + " Retail Order missing Request Date at Line Id:" + lineNo;
										} else {
											// is on or before 7 days from now
											bUpdateSO = validRequestDate(requestDate);
											if (!bUpdateSO){
												objSummary.Error = docNum + " Retail Order has invalid Request Date at Line Id:" + lineNo;
											}
										}
									} else {
										bUpdateSO = true;
									}
									
									if (bUpdateSO){
										invCount ++;
										//* Create Fulfillment Order - checkbox
										recSO.setSublistValue({
											sublistId: 'item',
											fieldId: 'custcol_create_fulfillment_order',
											line: iLine,
											value: true
										});
		//								var LineItem = LineNo + ": " + sItem;
										//*** Testing ONLY: Tax Amount ID= custcol_stxtaxamount
//										recSO.setSublistValue({
//											sublistId: 'item',
//											fieldId: 'custcol_stxtaxamount',
//											line: iLine,
//											value: "SC_" + taxAmountValue
//										});							
									}
									
								} else {
									bUpdateSO = false;						
									objSummary.Error = docNum + " Ship complete Order has backordered or uncommitted item at Line Id:" + lineNo + ", BackOrdered=" + intQtyBackOrdered + ", iUnCommitted=" + iUnCommitted;
								}	
								log.debug({
						    		title: "procShipCompleteOrder iLine=" + iLine + ", bUpdateSO=" + bUpdateSO,
						    		details: "docNum=" + docNum + ", idItem=" + idItem + ", sItem=" + sItem + ", stItemType=" + stItemType + ", intQtyBackOrdered=" + intQtyBackOrdered + ", lineNo=" + lineNo + ", iCommit=" + iCommit + ", iQty=" + iQty + ", iUnCommitted=" + iUnCommitted
						    	});
			    			} // Create Fulfillment Order = True
			    		}  // Inventory Items		
					}  // bUpdateSO? 
				} // Item Loop
			}
			// *** Save Sales order: SHip Complete = True
			if (bUpdateSO && invCount > 0){
				var updateID = recSO.save({
					enableSourcing: false,
					ignoreMandatoryFields: false
				});
			
	    		log.audit({
		    		title: "procShipCompleteOrder Order Updated updateID=" + updateID,
		    		details: "Tran ID = " + docNum + ", soID=" + soID + ", invCount=" + invCount + ", shipComplete=" + shipComplete + ", iChannel=" + iChannel
		    	});
    		} else {
    			if (!objSummary.Error){
    				objSummary.Error = "SKIP Ship Complete Order docNum = " + docNum + ", invCount=" + invCount + ", iChannel=" + iChannel + ", bCreateFO=" + bCreateFO;
    			}
    			log.audit({
            		title: "procShipCompleteOrder Skip Order bUpdateSO=" + bUpdateSO,
            		details: "SKIP docNum=" + docNum + ", invCount=" + invCount + ", bCreateFO=" + bCreateFO + ", shipComplete=" + shipComplete + ", iChannel=" + iChannel
            	});
    		}
		}
    	// objSummary: tranID, iCount, bShipComp, Error, arrItems  	
//    	objSummary.arrItems = arrItems;
    	objSummary.iCount = invCount;
    	return objSummary;
    }
    
    function searchSOGeneralHolds(soID)
    {
    	var customrecord_nls_general_holdSearchObj = search.create({
		   type: "customrecord_nls_general_hold",
		   filters: [
		      ["custrecord_nls_gh_hold_status","anyof","2"], 
		      "AND", 
		      ["custrecord_nls_gh_hold_transaction.internalidnumber","equalto",soID], 
		      "AND", 
		      ["custrecord_nls_gh_hold_transaction.mainline","is","T"]
		   ],
		   columns: [
		      search.createColumn({
		         name: "id",
		         sort: search.Sort.DESC
		      }),
		      "custrecord_nls_gh_hold_reason",
		      "custrecord_nls_gh_hold_status",
		      "custrecord_nls_gh_hold_detail",
		      "custrecord_nls_gh_hold_transaction",
		      "created",
		      "lastmodifiedby"
		   ]
		});
    	
    	var searchResultCount = customrecord_nls_general_holdSearchObj.runPaged().count;
//    		customrecord_nls_general_holdSearchObj.run().each(function(result){
//    		   // .run().each has a limit of 4,000 results
//    		   return true;
//    		});
    	return searchResultCount;
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
