/*
 * Progressive Leasing Project: Library, Create, Validate 
 * Author: KCHANG
 * Last Modified: 5/19/2017
 */
define(['N/record', 'N/search', 'N/error', './NLS_Lib_SO'],

function(record, search, error, lib) {
	// Progressive Leasing
	var CONSTANT_SUBSIDIARY_US = '1';
	var CONSTANT_CHANNEL_DIRECT = '1';
	var arNotLeasingItemTypes = ['Service'];
	// Payment Method List: Progressive Leasing = 103?
	var CONSTANT_PAY_TYPE_LEASING = '109';
	// Accounting List: Payment Method : Progressive Leasing = 27?
	var CONSTANT_PAY_METHOD_LEASING = '27';
	// 173 eBizNET WMS Sales Order – Direct Integra
	// 161 eBizNET WMS Sales Order - Direct
	// 170 eBizNET WMS Sales Order - Support
	var arrLeasingForms = ['173','161','170'];
//	var arrLeasingForms = [RETAIL_Store_FORM];
	var arrNoBillToLeasingState = ['NJ', 'WI', 'MN', 'VT', 'IL'];
	var CONSTANT_NO_LEASING_STATE = 'IL';	
	// Entity/Use Code = J = '3'
	var CONSTANT_LEASING_EXEMPT_CODE = '3';  // G
	var arNotSupprtedItemTypes = ['Discount', 'Subtotal', 'Service', 'OthCharge', 'Payment', 'Markup'];	
	var arrNonExpediteState = ['HI', 'AK', 'PR'];
	//***** Expedited Shipping ***** Nautilus Mode of Transport
	var MOT_Expedited_2DA = '4';
	var MOT_Expedited_Overnight = '3';
	var arrExpediteShipItems = [MOT_Expedited_2DA, MOT_Expedited_Overnight];
	
	function CreateProgLeasingRecord(objApplication, entityID, idCustomer) {
    	//Create Custom Record: Progressive Leasing, ID=customrecord_nls_progressive_leasing		
    	var recordId;
    	if (objApplication && objApplication.sAccountNumber){
    		var sAccountNumber = objApplication.sAccountNumber;
    		var plAction = '1';
	    	var appData = {
	    			custrecord_nls_pl_application_id: objApplication.sApplicationID,
	    			custrecord_nls_pl_account_number: sAccountNumber,
	    			custrecord_nls_pl_customer: idCustomer,
	    			custrecord_nls_pl_entity_id: entityID,
	    			custrecord_nls_pl_credit_line: objApplication.fCreditLine,
	    			custrecord_nls_pl_status: 'SUCCESS',
	    			custrecord_nls_pl_contract_status: 'Approved'
	            };
	    	log.debug({
				title: "CreateProgLeasingRecord",
				details: "Application ID=" + objApplication.sApplicationID + ", Account Number=" + sAccountNumber
				+ ", Credit Limit=" + objApplication.fCreditLine
			});
	    	
	    	var objRecord = record.create({
	            type: 'customrecord_nls_progressive_leasing', 
	            isDynamic: true
	        });
	    	// Name: PL-Account#
	    	objRecord.setValue({
                fieldId: 'name',
                value: "PL-" + sAccountNumber
            });
	    	for ( var key in appData) {
                if (appData.hasOwnProperty(key)) {
                	objRecord.setValue({
                        fieldId: key,
                        value: appData[key]
                    });
                }
            }
            
            // PL WS Actions
            objRecord.setValue({
                fieldId: 'custrecord_nls_pl_ws_action',
                value: plAction
            });
            var recordId = objRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: false
            });	    		
    	}
    	return recordId;
    }
	
	function CreateProgressiveLeasingWebOrder(objOrder, entityID, idCustomer, obLeasing) {
    	//Custom Record: Progressive Leasing, ID=customrecord_nls_progressive_leasing
		// DF-11890 Web orders are missing the Entity ID on the Progressive Leasing Custom record
    	var recordId;
    	if (objOrder && entityID){
//    		var plAction = '1';
    		var sAcctNum = objOrder.getValue('custbody_nls_pl_contract_number');
        	var sEsignURL = objOrder.getValue('custbody_nls_pl_esign_url');
        	var sCreditLimit = objOrder.getValue('custbody_nls_pl_credit_line');
        	var fCreditLimit = 0;
        	if (sCreditLimit){
        		fCreditLimit = lib.forceParseFloat(sCreditLimit);
        	}
	    	var appData = {
	    			custrecord_nls_pl_account_number: sAcctNum,
	    			custrecord_nls_pl_customer: idCustomer,
	    			custrecord_nls_pl_credit_line: fCreditLimit,
	    			custrecord_nls_pl_entity_id: entityID,
	    			custrecord_nls_pl_contract_status: 'Approved'
	            };
	    	log.debug({
				title: "CreateProgressiveLeasingWebOrder",
				details: "entityID=" + entityID + ", Account Number=" + sAcctNum + ", Credit Limit=" + fCreditLimit
			});
	    	
	    	var objRecord = record.create({
	            type: 'customrecord_nls_progressive_leasing', 
	            isDynamic: true
	        });
	    	// Name: PL-Account#
	    	objRecord.setValue({
                fieldId: 'name',
                value: "PL-" + sAcctNum
            });
	    	for ( var key in appData) {
                if (appData.hasOwnProperty(key)) {
                	objRecord.setValue({
                        fieldId: key,
                        value: appData[key]
                    });
                }
            }
            if (objOrder && objOrder.id){            	
	    		var orderData = {
	    			custrecord_nls_pl_sales_order: objOrder.id,		    		
	    			custrecord_nls_pl_order_id: objOrder.getValue('tranid'),	    			
	    			custrecord_nls_pl_total_amount: objOrder.getValue('total'),
	    			custrecord_nls_pl_tax_total: objOrder.getValue('taxtotal'),
	    			custrecord_nls_pl_order_date: objOrder.getValue('trandate')
	    		}
	    		for ( var key in orderData) {
	                if (orderData.hasOwnProperty(key)) {
	                	objRecord.setValue({
	                        fieldId: key,
	                        value: orderData[key]
	                    });
	                }
	            }
	    		if (obLeasing && obLeasing.sMerchandise){
	    			log.debug({
	    				title: "CreateProgressiveLeasingWebOrder obLeasing",
	    				details: "obLeasing.sMerchandise=" + obLeasing.sMerchandise + ", obLeasing.sErrorMessage=" + obLeasing.sErrorMessage
	    			});
	    			objRecord.setValue({
            			fieldId: 'custrecord_nls_pl_merchandise',
            			value: obLeasing.sMerchandise
            		});
	    		}
	    		if (obLeasing && obLeasing.sErrorMessage){
	    			objRecord.setValue({
            			fieldId: 'custrecord_nls_pl_error_message',
            			value: obLeasing.sErrorMessage
            		});
	    		}
	    		var eSignURL = objOrder.getValue('custbody_nls_pl_esign_url');
            	if (eSignURL){
//            		plAction = '2';
            		objRecord.setValue({
            			fieldId: 'custrecord_nls_pl_esign_url',
            			value: eSignURL
            		});
            	}	    		
	    	}
            // PL WS Actions
//            objRecord.setValue({
//                fieldId: 'custrecord_nls_pl_ws_action',
//                value: plAction
//            });
            recordId = objRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: false
            });	    		
    	}
    	return recordId;
    }
	
	function UpdateProgressiveLeasingSubmitOrder(idPL, objOrder, obLeasing, objWS, dSubmitDate) {
		// Submit Order 
    	var bOK = true;
    	if (idPL && objOrder && objOrder.id){
	    	var objRecord = record.load({
	            type: 'customrecord_nls_progressive_leasing', 
	            id: idPL,
	            isDynamic: true
	        });	    		
            
	    	// eSignURL & WS Action
    		var plAction = '2';
	    	var orderID = objRecord.getValue('custrecord_nls_pl_sales_order');
	    	if (!orderID){	    		
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_sales_order',
	    			value: objOrder.id
	    		});
	    	}

	    	var tranID = objRecord.getValue('custrecord_nls_pl_order_id');
	    	if (!tranID){
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_order_id',
	    			value: objOrder.getValue('tranid')
	    		});
	    	}
			
    		var orderData = {    			
    			custrecord_nls_pl_total_amount: objOrder.getValue('total'),
    			custrecord_nls_pl_tax_total: objOrder.getValue('taxtotal')    			
    		}
    		for (var key in orderData) {
                if (orderData.hasOwnProperty(key)) {
                	objRecord.setValue({
                        fieldId: key,
                        value: orderData[key]
                    });
                }
            }
    		
    		var eSignURL = objOrder.getValue('custbody_nls_pl_esign_url');
        	if (eSignURL){        		
        		objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_esign_url',
        			value: eSignURL
        		});
        	}
        	// Order Submit Date
        	if (dSubmitDate){
        		objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_order_date', 
        			value: dSubmitDate
        		});
        	}
        	// Update Credit Limit on SO.custbody_nls_pl_credit_line
	    	var creditLimit = objOrder.getValue('custbody_nls_pl_credit_line');
	    	if (creditLimit){
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_credit_line',
	    			value: creditLimit
	    		});
	    	}
        	if (obLeasing && obLeasing.sMerchandise){
    			log.debug({
    				title: "UpdateProgressiveLeasingOrder obLeasing",
    				details: "obLeasing.sMerchandise=" + obLeasing.sMerchandise + ", obLeasing.sErrorMessage=" + obLeasing.sErrorMessage
    			});
    			objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_merchandise',
        			value: obLeasing.sMerchandise
        		});
    		}
        	var sErrorMessage = "";
    		if (obLeasing && obLeasing.sErrorMessage){
    			sErrorMessage = obLeasing.sErrorMessage;
    			
    		}
    		if (objWS && objWS.errorMessage){
    			sErrorMessage += objWS.errorMessage;
    		}    		
    		
    		objRecord.setValue({
    			fieldId: 'custrecord_nls_pl_error_message',
    			value: sErrorMessage
    		});
    		
    		if (objWS && objWS.status){    			
    			objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_status',
	    			value: objWS.status
	    		});
    		}
    		var sErrorCode = "";
    		if (objWS && objWS.ErrorCode){
    			sErrorCode = objWS.ErrorCode;
    		}
    		objRecord.setValue({
    			fieldId: 'custrecord_nls_pl_error_code',
    			value: sErrorCode
    		});
    		if (objWS && objWS.responseXML){    			
    			objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_response_xml',
	    			value: objWS.responseXML
	    		});
    		}
    		if (objWS && objWS.requestXML){    			
    			objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_request_xml',
	    			value: objWS.requestXML
	    		});
    		}
        	// PL WS Actions	    	
            objRecord.setValue({
                fieldId: 'custrecord_nls_pl_ws_action',
                value: plAction
            });	    
            var recordId = objRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: false
            });	    		
    	}
    	return bOK;
	}
	
	function UpdateProgressiveLeasingOKDelover(idPL, objWS) {
		var bOK = true;
    	if (idPL && objWS){   		
    		var objRecord = record.load({
	            type: 'customrecord_nls_progressive_leasing', 
	            id: idPL,
	            isDynamic: true
	        }); 
    		// OK to Deliver
			objRecord.setValue({
    			fieldId: 'custrecord_nls_pl_ok_to_deliver', 
    			value: objWS.bDeliverOK
    		});
    		
        	//approvalLimit
    		if (objWS.approvalLimit){
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_approval_limit', 
	    			value: objWS.approvalLimit
	    		});
//	    		log.debug({
//					title: "Middle objWS 1",
//					details: "objWS.approvalLimit= " + objWS.approvalLimit + ", objWS.bDeliverOK=" + objWS.bDeliverOK
//				});
    		}
    		
    		// Approval Status: custrecord_nls_pl_approval_status
    		if (objWs.approvalStatus){
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_approval_status', 
	    			value: objWS.approvalStatus
	    		});
//	    		log.debug({
//					title: "Middle objWS 2",
//					details: "objWS.approvalStatus= " + objWS.approvalStatus
//				});
    		}
    		// Status Reason
    		if (objWS.statusReason){
    			objRecord.setValue({
        			fieldId: 'custrecord_nls_status_reason', 
        			value: objWS.statusReason
        		}); 
//    			log.debug({
//    				title: "Middle objWS 3",
//    				details: "objWS.statusReason=" + objWS.statusReason
//    			});
    		}    		
    		
    		if (objWS.errorMessage){    			
    			objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_error_message',
        			value: objWS.errorMessage
        		});
//    			log.debug({
//    				title: "Middle objWS 4",
//    				details: "objWS.errorMessage= " + objWS.errorMessage
//    			});
    		}
    		// WS Status: custrecord_nls_pl_status
    		if (objWS.status){    			
    			objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_status',
	    			value: objWS.status
	    		});
//    			log.debug({
//    				title: "Middle objWS 5",
//    				details: "objWS.status= " + objWS.status
//    			});
    		}
    		
    		if (objWS.ErrorCode){
    			objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_error_code',
        			value: objWS.ErrorCode
        		});
//    			log.debug({
//    				title: "Middle objWS 6",
//    				details: "objWS.ErrorCode= " + objWS.ErrorCode
//    			});
    		}
    		
        	// PL WS Actions	    	
    		var plAction = '3';
            objRecord.setValue({
                fieldId: 'custrecord_nls_pl_ws_action',
                value: plAction
            });	    
//            log.debug({
//				title: "Before SAve",
//				details: "plAction=" + plAction
//			});
            
            var recordId = objRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: false
            });	    		
//            log.debug({
//				title: "After SAve",
//				details: "recordId=" + recordId
//			});
    	}
    	return bOK;
	}
	
	function UpdateProgressiveLeasingOrder(idPL, objOrder, obLeasing, objWS) {
    	// Submit Order 
    	var bOK = true;
    	if (idPL && objOrder && objOrder.id){
	    	var objRecord = record.load({
	            type: 'customrecord_nls_progressive_leasing', 
	            id: idPL,
	            isDynamic: true
	        });	    		
            
	    	// eSignURL & WS Action
    		var plAction = '2';
	    	var orderID = objRecord.getValue('custrecord_nls_pl_sales_order');
	    	if (!orderID){
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_sales_order',
	    			value: objOrder.id
	    		});
	    	} 
	    	// Update Tran ID
	    	var tranID = objRecord.getValue('custrecord_nls_pl_order_id');
	    	if (!tranID){
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_order_id',
	    			value: objOrder.getValue('tranid')
	    		});
	    	}
			// Update Credit Limit on SO.custbody_nls_pl_credit_line
	    	var creditLimit = objOrder.getValue('custbody_nls_pl_credit_line');
	    	if (creditLimit){
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_credit_line',
	    			value: creditLimit
	    		});
	    	}
    		var orderData = {    			
    			custrecord_nls_pl_total_amount: objOrder.getValue('total'),
    			custrecord_nls_pl_tax_total: objOrder.getValue('taxtotal')    			
    		}
    		for (var key in orderData) {
                if (orderData.hasOwnProperty(key)) {
                	objRecord.setValue({
                        fieldId: key,
                        value: orderData[key]
                    });
                }
            }
    		
    		var eSignURL = objOrder.getValue('custbody_nls_pl_esign_url');
        	if (eSignURL){        		
        		objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_esign_url',
        			value: eSignURL
        		});
        	}
        	// Order Submit Date
        	var dSubmitDate = objRecord.getValue('custrecord_nls_pl_order_date');
        	if (!dSubmitDate){
        		objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_order_date', 
        			value: objRecord.getValue('trandate')
        		});
        	}
        	if (obLeasing && obLeasing.sMerchandise){
    			log.debug({
    				title: "UpdateProgressiveLeasingOrder obLeasing",
    				details: "obLeasing.sMerchandise=" + obLeasing.sMerchandise + ", obLeasing.sErrorMessage=" + obLeasing.sErrorMessage
    			});
    			objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_merchandise',
        			value: obLeasing.sMerchandise
        		});
    		}        		    		
    		
        	var sErrorMessage = "";
    		if (obLeasing && obLeasing.sErrorMessage){
    			sErrorMessage = obLeasing.sErrorMessage;
    			
    		}
    		if (objWS && objWS.errorMessage){
    			sErrorMessage += objWS.errorMessage;
    		}    		
    		
    		objRecord.setValue({
    			fieldId: 'custrecord_nls_pl_error_message',
    			value: sErrorMessage
    		});
    		
    		if (objWS && objWS.status){
    			// PL WS Status
    			objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_status',
	    			value: objWS.status
	    		});
    			// NLS Financing Approval Status: Order Submit        	
        		objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_approval_status', 
        			value: objWS.status
        		});
    		}
    		var sErrorCode = "";
    		if (objWS && objWS.ErrorCode){
    			sErrorCode = objWS.ErrorCode;
    		}
    		objRecord.setValue({
    			fieldId: 'custrecord_nls_pl_error_code',
    			value: sErrorCode
    		});
    		if (objWS && objWS.responseXML){    			
    			objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_response_xml',
	    			value: objWS.responseXML
	    		});
    		}
    		if (objWS && objWS.requestXML){    			
    			objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_request_xml',
	    			value: objWS.requestXML
	    		});
    		}
        	// PL WS Actions	    	
            objRecord.setValue({
                fieldId: 'custrecord_nls_pl_ws_action',
                value: plAction
            });	    
            var recordId = objRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: false
            });	    		
    	}
    	return bOK;
    }
	
	function UpdateProgressiveLeasingCS(idPL, objCS) {
    	// Submit Order 
    	var bOK = true;
    	if (idPL && objCS){
	    	var objRecord = record.load({
	            type: 'customrecord_nls_progressive_leasing', 
	            id: idPL,
	            isDynamic: true
	        });	    		
            
	    	var csID = objRecord.getValue('custrecord_nls_pl_linked_cashsales');
	    	if (!csID){	    		
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_linked_cashsales',
	    			value: objCS.id
	    		});
	    	} 
	    	
	    	var tranID = objRecord.getValue('custrecord_nls_pl_cs_id');
	    	if (!tranID){
	    		objRecord.setValue({
	    			fieldId: 'custrecord_nls_pl_cs_id',
	    			value: objCS.getValue('tranid')
	    		});
	    	}
    		
    		var csTotal = objRecord.getValue('custrecord_nls_pl_cs_total');
        	if (!csTotal){
        		objRecord.setValue({
        			fieldId: 'custrecord_nls_pl_cs_total',
        			value: objCS.getValue('total')
        		});
        	}
        	
        	// Ship Date: custrecord_nls_ship_date
        	var shipDate = objRecord.getValue('custrecord_nls_ship_date');
        	if (!shipDate){
        		objRecord.setValue({
        			fieldId: 'custrecord_nls_ship_date',
        			value: objCS.getValue('trandate')
        		});
        	}
            var recordId = objRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: false
            });	    		
    	}
    	return bOK;
    }
	function SearchProgLeasingByAccountNum(sAccountNumber){
		var oResult = new Object();
		var customrecord_nls_progressive_leasingSearchObj = search.create({
		   type: "customrecord_nls_progressive_leasing",
		   filters: [
		      ["custrecord_nls_pl_account_number","is",sAccountNumber]
		   ],
		   columns: [
		      search.createColumn({
		         name: "name",
		         sort: search.Sort.ASC
		      }),
		      "custrecord_nls_pl_application_id",
		      "custrecord_nls_pl_account_number",
		      "custrecord_nls_pl_customer",
		      "custrecord_nls_pl_entity_id",
		      "custrecord_nls_pl_sales_order",
		      "custrecord_nls_pl_order_id",
		      "custrecord_nls_pl_linked_cashsales",
		      "custrecord_nls_pl_approval_status",
		      "custrecord_nls_pl_approval_limit",
		      "custrecord_nls_pl_esign_url",
		      "custrecord_nls_pl_ok_to_deliver",
		      "custrecord_nls_pl_delivery_date"
		   ]
		});
		oResult.count = customrecord_nls_progressive_leasingSearchObj.runPaged().count;
		
		customrecord_nls_progressive_leasingSearchObj.run().each(function(result){
		   // .run().each has a limit of 4,000 results
		   oResult.result = result;
		});
		return oResult;
	}
	
	function SearchProgLeasingSubmitOrder(sAccountNumber, soID){
		// EsignURL is EMPTY
		var oResult = new Object();
		if (sAccountNumber && soID){
			var customrecord_nls_progressive_leasingSearchObj = search.create({
			   type: "customrecord_nls_progressive_leasing",
			   filters: [
			      ["custrecord_nls_pl_account_number","is",sAccountNumber], 
			      "AND", 
			      ["custrecord_nls_pl_sales_order.internalidnumber","equalto",soID], 
			      "AND", 
			      ["custrecord_nls_pl_sales_order.mainline","is","T"]
//			      "AND", 
//			      ["custrecord_nls_pl_esign_url","isempty",""]
			   ],
			   columns: [
			      search.createColumn({
			         name: "name",
			         sort: search.Sort.ASC
			      }),
			      "custrecord_nls_pl_application_id",
			      "custrecord_nls_pl_account_number",
			      "custrecord_nls_pl_customer",
			      "custrecord_nls_pl_entity_id",
			      "custrecord_nls_pl_sales_order",
			      "custrecord_nls_pl_order_id",
			      "custrecord_nls_pl_approval_status",
			      "custrecord_nls_pl_approval_limit",
			      "custrecord_nls_pl_linked_cashsales",
			      "custrecord_nls_pl_ok_to_deliver",
			      "custrecord_nls_pl_delivery_date"
			   ]
			});
			oResult.count = customrecord_nls_progressive_leasingSearchObj.runPaged().count;
			customrecord_nls_progressive_leasingSearchObj.run().each(function(result){
			   // .run().each has a limit of 4,000 results
				oResult.result = result;
			});
		} else {
			throw error.create({
                name: 'MISSING_REQ_PARAM_' + "SearchProgLeasingSubmitOrder",
                message: "Please enter required parameters before searching: [sAccountNumber, soID]"
            });
		}
		return oResult;
	}
	
	function SearchProgLeasingReSubmitOrder(sAccountNumber, soID){
		// OK to Deliver is Not True
		var oResult = new Object();
		if (sAccountNumber && soID){
			var customrecord_nls_progressive_leasingSearchObj = search.create({
			   type: "customrecord_nls_progressive_leasing",
			   filters: [
			      ["custrecord_nls_pl_account_number","is",sAccountNumber], 
			      "AND", 
			      ["custrecord_nls_pl_sales_order.internalidnumber","equalto",soID], 
			      "AND", 
			      ["custrecord_nls_pl_ok_to_deliver","isnot","true"], 
			      "AND",
			      ["custrecord_nls_pl_sales_order.mainline","is","T"]
			   ],
			   columns: [
			      search.createColumn({
			         name: "name",
			         sort: search.Sort.ASC
			      }),
			      "custrecord_nls_pl_application_id",
			      "custrecord_nls_pl_account_number",
			      "custrecord_nls_pl_customer",
			      "custrecord_nls_pl_entity_id",
			      "custrecord_nls_pl_sales_order",
			      "custrecord_nls_pl_order_id",
			      "custrecord_nls_pl_approval_status",
			      "custrecord_nls_pl_approval_limit",
			      "custrecord_nls_pl_esign_url",
			      "custrecord_nls_pl_ok_to_deliver",
			      "custrecord_nls_pl_delivery_date"
			   ]
			});
			oResult.count = customrecord_nls_progressive_leasingSearchObj.runPaged().count;
			customrecord_nls_progressive_leasingSearchObj.run().each(function(result){
			   // .run().each has a limit of 4,000 results
				oResult.result = result;
			});
		} else {
			throw error.create({
                name: 'MISSING_REQ_PARAM_' + "SearchProgLeasingSubmitOrder",
                message: "Please enter required parameters before searching: [sAccountNumber, soID]"
            });
		}
		return oResult;
	}
	
	/**
	 * Search Progressive Leasing by Account Number and Sales Order
	 * @param sAccountNumber
	 * @param soID
	 * @returns
	 */
	function SearchWebProgLeasingOrder(sAccountNumber, soID){
		var oResult = new Object();
		var oSearchWebProgLeasingOrder = search.create({
			   type: "customrecord_nls_progressive_leasing",
			   filters: [			      
			      ["custrecord_nls_pl_account_number","is", sAccountNumber], 
			      "AND", 
			      ["custrecord_nls_pl_sales_order.internalidnumber","equalto", soID]
			   ],
			   columns: [
			      search.createColumn({
			         name: "name",
			         sort: search.Sort.ASC
			      }),
			      "custrecord_nls_pl_application_id",
			      "custrecord_nls_pl_account_number",
			      "custrecord_nls_pl_customer",
			      "custrecord_nls_pl_entity_id",
			      "custrecord_nls_pl_sales_order",
			      "custrecord_nls_pl_order_id",
			      "custrecord_nls_pl_approval_status",
			      "custrecord_nls_pl_approval_limit",
			      "custrecord_nls_pl_ok_to_deliver",
			      "custrecord_nls_pl_delivery_date",
			      "custrecord_nls_pl_cs_id",
			      "custrecord_nls_pl_linked_cashsales"
			   ]
			});
			
		oResult.count = oSearchWebProgLeasingOrder.runPaged().count;
		
		oSearchWebProgLeasingOrder.run().each(function(result){
		   // .run().each has a limit of 4,000 results
		   oResult.result = result;
		});
		return oResult;
	}
	
	function SearchProgLeasingByCustAcct(custId, AcctNum){
		var oResult = new Object();
		var oSearchProgLeasingByCustAcct = search.create({
		   type: "customrecord_nls_progressive_leasing",
		   filters: [
			      ["custrecord_nls_pl_customer.internalidnumber","equalto", custId], 
			      "AND", 
			      ["custrecord_nls_pl_account_number","is", AcctNum],
			      "AND", 
			      ["custrecord_nls_pl_esign_url","isempty",""]
			   ],
		   columns: [
		      search.createColumn({
		         name: "name",
		         sort: search.Sort.ASC
		      }),
		      "custrecord_nls_pl_application_id",
		      "custrecord_nls_pl_account_number",
		      "custrecord_nls_pl_customer",
		      "custrecord_nls_pl_entity_id",
		      "custrecord_nls_pl_sales_order",
		      "custrecord_nls_pl_order_id",
		      "custrecord_nls_pl_approval_status",
		      "custrecord_nls_pl_approval_limit",
		      "custrecord_nls_pl_ok_to_deliver",
		      "custrecord_nls_pl_delivery_date",
		      "custrecord_nls_pl_status",
		      "custrecord_nls_pl_error_message"
		   ]
		});
		
		oResult.count = oSearchProgLeasingByCustAcct.runPaged().count;
		
		oSearchProgLeasingByCustAcct.run().each(function(result){
		   // .run().each has a limit of 4,000 results
		   oResult.result = result;
		});
		return oResult;
	}
	
	function SearchProgLeaseApplByCustNoOrder(custId){
		var oResult = new Object();
		var customrecord_nls_progressive_leasingSearchObj = search.create({
		   type: "customrecord_nls_progressive_leasing",
		   filters: [
		      ["custrecord_nls_pl_customer.internalidnumber","equalto",custId], 
		      "AND", 
		      ["custrecord_nls_pl_sales_order.internalidnumber","isempty",""]
		   ],
		   columns: [
		      search.createColumn({
		         name: "name",
		         sort: search.Sort.ASC
		      }),
		      "custrecord_nls_pl_application_id",
		      "custrecord_nls_pl_account_number",
		      "custrecord_nls_pl_customer",
		      "custrecord_nls_pl_entity_id",
		      "custrecord_nls_pl_sales_order",
		      "custrecord_nls_pl_order_id",
		      "custrecord_nls_pl_approval_status",
		      "custrecord_nls_pl_approval_limit",
		      "custrecord_nls_pl_ok_to_deliver",
		      "custrecord_nls_pl_delivery_date"
		   ]
		});
		oResult.count = customrecord_nls_progressive_leasingSearchObj.runPaged().count;
		customrecord_nls_progressive_leasingSearchObj.run().each(function(result){
		   // .run().each has a limit of 4,000 results
			oResult.result = result;
		});
		return oResult;
	}
	/**
     * Validate Order Header Level for Progressive Leasing
     * @param objSalesOrder: payment Type, Payment Method, Custom Form, MOT, Bill To State
     * @returns obLeasing.bOK, obLeasing.bLeasing, obLeasing.sErrorMessage
     */
    function ValidateProgressiveLeasing(objSalesOrder, addrDetails){
    	var obLeasing = new Object();
    	var curForm = objSalesOrder.getValue('customform');
    	var sSubsidiary = objSalesOrder.getValue('subsidiary');
    	var iChannel = objSalesOrder.getValue('custbody_nls_channel');    	
    	var PayType = objSalesOrder.getValue('custbody_nls_payment_method');
    	var PayMethod = objSalesOrder.getValue('paymentmethod');
    	var iCust = objSalesOrder.getValue('entity');
    	
    	// Order total Validation
    	var sAccountNum = objSalesOrder.getValue('custbody_nls_pl_contract_number');
    	var sCreditLine = objSalesOrder.getValue('custbody_nls_pl_credit_line');
    	var sMerchandise = '';
    	
    	obLeasing.bHasPayments = true;		// Order total can be recalculate
    	obLeasing.bOK = true;	// Order cannot be saved    	
    	obLeasing.bLeasing = false;
    	obLeasing.bSaveCalculate = true;		// OK to Save or calculate Order when NOT Leasing or YES Leasing
    	obLeasing.bSubmitOrder = false;		// Order can be submitted to Progressive Leasing
    	obLeasing.sMerchandise = "";
    	obLeasing.sErrorCode = "";
    	obLeasing.sErrorMessage = "";
    	obLeasing.shipAddr = "";
    	
    	if (!PayType || !PayMethod){
    		obLeasing.bHasPayments = false;
    	}
    	
		//1. Payment Type & Payment Method is Progressive Leasing
		if (obLeasing.bHasPayments && PayType === CONSTANT_PAY_TYPE_LEASING && PayMethod === CONSTANT_PAY_METHOD_LEASING){
			// NOT OK for Progressive Leasing:
	    	// Form, Subsidiary, Channel
	    	if (!lib.inArray(arrLeasingForms, curForm)) {    			
				obLeasing.sErrorMessage = "Invalid Custom Form for Progressive Leasing Payment Methods!";	
				obLeasing.sErrorCode = "999";
				obLeasing.bOK = false;
			} else if (sSubsidiary !== CONSTANT_SUBSIDIARY_US){
				obLeasing.sErrorMessage = "Invalid Subsidiary for Progressive Leasing Program: Subsidiary=" + sSubsidiary;
				obLeasing.sErrorCode = "999";
				obLeasing.bOK = false;
			} else if (!iCust || iChannel !== CONSTANT_CHANNEL_DIRECT){
				obLeasing.sErrorMessage = "Invalid Customer/ Subsidiary for Progressive Leasing Program: Channel=" + iChannel + ", iCust=" + iCust;
				obLeasing.sErrorCode = "999";
				obLeasing.bOK = false;
			} else if (sCreditLine && isNaN(sCreditLine)){
				obLeasing.sErrorMessage = "Invalid Prog Leasing Credit Line: " + sCreditLine + "\nPlease enter a number\n";
				obLeasing.sErrorCode = "999";
				obLeasing.bOK = false;
			}
	    	// OK to save order?
			obLeasing.bSaveCalculate = obLeasing.bOK;
	    	if (obLeasing.bOK){	    		
	    		//3. Check MOT    				
	    		var sMOT = objSalesOrder.getValue('custbody_nls_mode_of_transport');
	    		if (sMOT && lib.inArray(arrExpediteShipItems, sMOT)) {
	    			obLeasing.bSaveCalculate = false;
	    			obLeasing.sErrorMessage = "Expedite Shipping is not allowed for Progressive Leasing!";
	    			obLeasing.sErrorCode = "900";
	    		} else {
	    			obLeasing.bLeasing = true;
	    		}
	    		if (obLeasing.bLeasing && obLeasing.bOK){
		    		//4. Check Bill To address
		    		var billAddress = objSalesOrder.getValue('billaddress');
		    		var billState = objSalesOrder.getValue('billstate');
		    		if (!billState){
		    			var billAddrId = objSalesOrder.getValue('billaddresslist');
		    			if (billAddrId){
		    				var objBillAddr = lib.SearchCustomerAddrID(iCust, billAddrId);
		    				if (objBillAddr && objBillAddr.state){
		    					billState = objBillAddr.state;
		    				}
		    			}
		    		}
		    		// Bill to Checking Qualified Bill To State var arrNoBillToLeasingState = ['NJ', 'WI', 'MN', 'VT', 'IL'];			    		
		    		if (!billState || lib.inArray(arrNoBillToLeasingState, billState) || billState === CONSTANT_NO_LEASING_STATE){
		    			obLeasing.bSaveCalculate = false;
		    			obLeasing.bLeasing = false;
		    			obLeasing.sErrorMessage = "Leasing is not Allowed for Bill to State: " + billState + ", billAddress=" + billAddress;
		    			obLeasing.sErrorCode = "800";
		    		} else {
		    			var sTranID = objSalesOrder.getValue('tranid');
//		    			if (objSalesOrder.id && sTranID){
		    				// Validate Account Number, Credit Line, 
	    				if (sAccountNum){
	    					if (sCreditLine){
	    						// Validate Credit Line
	    						var fCreditLimit = lib.forceParseFloat(sCreditLine);
	    						var fTotal = objSalesOrder.getValue('total');
	    						// Exeeding no more than 10% of Credit Limit 
	    						fCreditLimit = fCreditLimit * 1.1;
	    						if (fTotal <= fCreditLimit){
	    							obLeasing.bSubmitOrder = true;
	    						} else {
	    							// DF-11908 Prevent SAVE if PL order total exceeds 110% of the Progressive Leasing credit limit
//		    							obLeasing.bSaveCalculate = false;
	    							obLeasing.sErrorCode = '888';
	    							obLeasing.sErrorMessage = "Order Total exceeds 110% of approval by Progressive Leasing \n Lease ID = " + sAccountNum + ", Credit Limit = $" + sCreditLine + ", Current Total = $" + fTotal;
	    						}
	    					} else {
	    						// IG does not pass in Credit Line 
		    			    	var isIGOrder = objSalesOrder.getValue('custbody_nls_intgr_ig_order');
		    			    	var oriBMID = objSalesOrder.getValue('custbody_nls_finance_bmcustomernumber');
	    						if (isIGOrder || oriBMID){
	    							obLeasing.bSubmitOrder = false;
	    						} else {
	    							obLeasing.sErrorCode = "800";
	    							obLeasing.sErrorMessage = "Missing Credit Line for Approved Progressive Leasing - Lease ID = " + sAccountNum + ", sTranID=" + sTranID;
	    						}
	    					}
	    				} else {
	    					obLeasing.sErrorCode = "800";
	    					obLeasing.sErrorMessage = "Missing Progressive Lease ID for Progressive Leasing Payment Methods";
	    				}
	    				// Merchandises
		    			var itemCount = objSalesOrder.getLineCount('item');
		    			for (var iLine = 0; iLine < itemCount; iLine++){
		    				if (obLeasing.bSaveCalculate){
		    		    		// Item Type
		    		    		var stItemType = objSalesOrder.getSublistValue({
		    		        		sublistId: 'item',
		    		        		fieldId: 'itemtype',
		    		        		line: iLine
		    		        	});	    		
		    		        	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
		    		        		// Progressive Leasing -     	
		    						//"3. Checking Qualified Order Items..." + '\n'
		    		        		if (obLeasing.bLeasing && lib.inArray(arNotLeasingItemTypes, stItemType)){
		    		        			obLeasing.sErrorCode = "700";
		    		        			obLeasing.sErrorMessage = "Progressive Leasing ERROR - Invalid Item Type: " + stItemType + "\nPlease remove the Service item for Progressive Leasing Payment method";
		    		        			obLeasing.bSaveCalculate = false;
		    		        		}
		    		        	} else {
		    		        		// DF-11566 Ship to : CONSTANT_NO_LEASING_STATE = IL
		    		        		var shipAddr = objSalesOrder.getCurrentSublistValue({
		    			        		sublistId: 'item',
		    			        		fieldId: 'shipaddress'
		    			        	});					    		        		
//				    		        		
		    		        		if (shipAddr && !addrDetails){
		    		        			obLeasing.shipAddr = shipAddr;
		    		    				addrDetails = lib.SearchCustomerAddrID(iCust, shipAddr);		    		    				
		    		    			}
		    		        		if (addrDetails){			    		        			
		    		        			if (addrDetails.addrId){
		    		        				obLeasing.shipAddr = addrDetails.addrId;
		    		        			}
			    	    				if (addrDetails.state && addrDetails.state === CONSTANT_NO_LEASING_STATE){
			    	    					obLeasing.sErrorCode = "700";
			    	    					obLeasing.sErrorMessage = "Progressive Leasing ERROR - Invalid Ship To State at Line " + iLine + ", Ship To State=" + addrDetails.state;
			    	    					obLeasing.bSaveCalculate = false;
			    	    				}
		    		        		}
		    		        		var iQty = objSalesOrder.getSublistValue({
			    		        		sublistId: 'item',
			    		        		fieldId: 'quantity',
			    		        		line: iLine
			    		        	});	   
		    		        		var sItem = objSalesOrder.getSublistText({
			    		        		sublistId: 'item',
			    		        		fieldId: 'item',
			    		        		line: iLine
			    		        	});	
		    		        		if (sItem && iQty > 0){
		    		        			sMerchandise += sItem + ':' + iQty + ', ';
		    		        		}
		    		        	}
		    				}
		    			}			    			
//		    			} else {
//		    				obLeasing.sErrorMessage = "Order cannot be submitted to Progressive Leasing without Order ID";
//		    			}
		    		}
		    		obLeasing.sMerchandise = sMerchandise;
	    		}
	    	}
    		
    	}
    	return obLeasing;
    }
    
    return {
    	ValidateProgressiveLeasing: ValidateProgressiveLeasing,
    	CreateProgLeasingRecord: CreateProgLeasingRecord,
    	CreateProgressiveLeasingWebOrder: CreateProgressiveLeasingWebOrder,
    	UpdateProgressiveLeasingOrder: UpdateProgressiveLeasingOrder,
    	UpdateProgressiveLeasingSubmitOrder: UpdateProgressiveLeasingSubmitOrder,
    	UpdateProgressiveLeasingOKDelover: UpdateProgressiveLeasingOKDelover,
    	UpdateProgressiveLeasingCS: UpdateProgressiveLeasingCS,
    	SearchProgLeasingByCustAcct: SearchProgLeasingByCustAcct,
    	SearchWebProgLeasingOrder: SearchWebProgLeasingOrder,
    	SearchProgLeasingSubmitOrder: SearchProgLeasingSubmitOrder,
    	SearchProgLeasingReSubmitOrder: SearchProgLeasingReSubmitOrder,
    	SearchProgLeaseApplByCustNoOrder: SearchProgLeaseApplByCustNoOrder,
    	SearchProgLeasingByAccountNum: SearchProgLeasingByAccountNum
    };    
});
