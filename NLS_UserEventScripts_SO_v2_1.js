/**
 * @NApiVersion 2.x 
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * This user event script applies to Sales Order for Progressive Leasing Project, Ship complete, Entity Use Tax Code
 * DF-11467, DF-11462, DF-11471
 * Author: KCHANG * 
 * DF-11922 PL order not sent to Progressive Leasing on SubmitInvoiceInfo action
 * DF-11900 Do not allow more than one Progressive Leasing order to be submitted with the same PL Lease ID
 * Last Modified: 6/27/2017
 * DF-11934 Store error message on SO if eSign URL is not returned at Save and Submit
 * Last Modified: 7/06/2017
 * DF-9521 Direct Orders should settle complete based on payment method or finance partner
 * Add /NLS_Library_SS2.0 folder
 * DF-12567: Price Level, Location & Amount are editable by roles that are not permitted to do so
 * DF-10628: Items on orders are Defaulting to Next Price Level if Correct Level is Not Defined
 * DF-12571: Direct channel User is not allowed to modify Ship Complete field on sales order form
 * Last Modified: 10/30/2017
 */
define(['N/record', 'N/search', 'N/runtime', 'N/error', 'N/https', '../NLS_Library_SS2.0/NLS_Lib_SO', '../NLS_Library_SS2.0/NLS_Lib_ProgressiveLeasing', '../NLS_Library_SS2.0/NLS_Lib_Router_Services'],
/**
 * @param {serverWidget} serverWidget
 */
function(record, search, runtime, error, https, lib, lib_pl, nls_ws) {
	var CONSTANT_CHANNEL_DIRECT = '1';
	var CONSTANT_CHANNEL_RETAIL = '2';
	// Tax Codes
	var CONSTANT_NotTaxable_US = '-8';
	var CONSTANT_NotTaxable_CAN = '14877';
	var CONSTANT_TAXCODE_AVATAX_US = '27764';
	var CONSTANT_TAXCODE_AVATAX_CAN = '27767';
	var CONSTANT_TAXCODE_CCH_US = '8880';
	var CONSTANT_TAXCODE_CCH_CAN = '8883';
	var CONSTANT_SUBSIDIARY_US = '1';
	var CONSTANT_SUBSIDIARY_CA = '2';
	var FORM_INTERCOMPANY = '162';
	
	var arNotSupprtedItemTypes = ['Discount', 'Subtotal', 'Service', 'OthCharge', 'Payment', 'Markup'];
	var addrDetails;
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function NLS_beforeLoad(scriptContext) {
//    	var type = scriptContext.type;
//    	if (type === scriptContext.UserEventType.CREATE || type === scriptContext.UserEventType.EDIT){
//    		// runtime.executionContext === runtime.ContextType.USEREVENT
//        	var curContext = runtime.executionContext;    
//    		log.debug({
//    			title: 'NLS_beforeLoad',
//    			details: "type=" + type + ", curContext=" + curContext + ', scriptType=' + scriptContext.UserEventType.EDIT
//    		});
//    	}
    }    
   
    /**
     * Function definition to be triggered before record is loaded.
     * 1. Set Ship Complet: Context = Web Service
     * 2. Submit Invoice Info Call to Progressive Leasing: Context = User Event
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function NLS_beforeSubmit(scriptContext) {
    	var type = scriptContext.type;
    	// runtime.executionContext === runtime.ContextType.USEREVENT
    	var curContext = runtime.executionContext;
    	var curRecord = scriptContext.newRecord;
		var iChannel = curRecord.getValue('custbody_nls_channel');
		var bDoNOTSubmit = curRecord.getValue('custbody_nls_do_not_submit_order');
		var bOK = true;
//    	log.debug({
//			title: 'NLS_beforeSubmit',
//			details: "type=" + type + ", curContext=" + curContext + ', iChannel=' + iChannel + ", bDoNOTSubmit=" + bDoNOTSubmit
//		});

    	if (type === scriptContext.UserEventType.CREATE || type === scriptContext.UserEventType.EDIT){
    		// Web Service ONLY
    		if (curContext === runtime.ContextType.WEBSERVICES){   
    			// ONLY DIRECT CHANNEL
	    		if (iChannel === CONSTANT_CHANNEL_DIRECT){	    			
	    			// Progressive Leasing - Ship Complete
	    			SetSettleComplete(curRecord);
	    		}	    		
    		}
    		// Before SUBMIT: UE and EDIT
//    		if (curContext === runtime.ContextType.USEREVENT && type === scriptContext.UserEventType.EDIT){
    		if (type === scriptContext.UserEventType.EDIT){
    			// Save & Submit
    			if (iChannel === CONSTANT_CHANNEL_DIRECT && !bDoNOTSubmit){
    				// Settle Complete v2.0 DO NOT fire this for NON-progressive Leasing orders when Gap 181 scheduled script update/approve the order
    				var plLeaseID = curRecord.getValue('custbody_nls_pl_contract_number');
    				if (plLeaseID){
	    				log.debug({
	    					title: "BS_PL_CreatePL_SubmitInvoice",
	    					details: "bDoNOTSubmit=" + bDoNOTSubmit + ', iChannel=' + iChannel + ", type=" + type + ", curContext=" + curContext + ", plLeaseID=" + plLeaseID
	    				});
	    				//
						var bCallPL = PL_CreatePL_SubmitInvoice(curRecord);
						if (bCallPL){
	//						log.debug({
	//	    					title: "AFTER PL_CreatePL_SubmitInvoice DONE",
	//	    					details: "Updated bCallPL=" + bCallPL + " successfully!"
	//	    				});
						}
    				}
    			}
    		}
    		//*** GAP 217 ***
			// 1. Validate Item Price Level 
			// 2. Set FOB Price Level 
//    		if (curContext === runtime.ContextType.WEBSERVICES){}
//    		if (type === scriptContext.UserEventType.CREATE){
//    			var currentForm = curRecord.getValue('customform');
//    			if(currentForm !== FORM_INTERCOMPANY) { 
//    				bOK = BS_ValidatePriceLevel(curRecord);
//    			}
//    		}
    	}
    	return bOK;
    }
    
    function BS_ValidatePriceLevel(currentRecord){
    	// Before Submit
    	var bOK = true;
//    	var newPL = '-1';    	
//    	var PRICEL_EVEL_Employee = '51';    	
    	var itemCount = currentRecord.getLineCount('item');		
		//*** Part 1: Line Item					
		for (var i = 0; i < itemCount; i++) {
			var stItemType = currentRecord.getSublistValue({
	    		sublistId: 'item',
	    		fieldId: 'itemtype',
	    		line: i
	    	});
		
			if (stItemType === 'InvtPart' || stItemType === 'Kit') {	    	   		
//				var createPO = currentRecord.getSublistValue({
//					sublistId: 'item',
//					fieldId: 'createpo',
//					line: i
//				});
				var headPriceLevel = currentRecord.getValue('price');
				var sPriceLevel;
				var idCustomer = currentRecord.getValue('entity');
				if (!headPriceLevel){
					var objLookupPL = search.lookupFields({
			    		type: search.Type.CUSTOMER,
			    		id: idCustomer,
			    		columns: ['pricelevel']
			    	});
					if (objLookupPL && objLookupPL.pricelevel[0]){
						headPriceLevel = objLookupPL.pricelevel[0].value;
						sPriceLevel = objLookupPL.pricelevel[0].text;
					}
				}
				var currentPriceLevel = currentRecord.getSublistValue({
					sublistId: 'item',
					fieldId: 'price',
					line: i
				});
				// Inventory, Kit only
				var itemID = currentRecord.getSublistValue({
					sublistId: 'item',
					fieldId: 'item',
					line: i
				});
				var Subsidiary = currentRecord.getValue('subsidiary');
				var Currency = currentRecord.getValue('currency');
				var arrItemPriceLevels;
				if (itemID){
					// Currency: US = 1, Canada = 3, China RMB = 5
					arrItemPriceLevels = lib.SearchItemPriceLevel(itemID, Subsidiary, headPriceLevel, Currency);
				}
				log.debug({
					title: "BS_ValidatePriceLevel",
					details: "SearchItemPriceLevel currentPriceLevel=" + currentPriceLevel + ", headPriceLevel=" + headPriceLevel  
							+ ", currency=" + Currency + ", itemID=" + itemID + ", arrItemPriceLevels=" + arrItemPriceLevels
				});
				if (!headPriceLevel){
					headPriceLevel = currentPriceLevel;
				}
				
				if (arrItemPriceLevels && lib.inArray(arrItemPriceLevels, headPriceLevel)) {
					// Do nothing
				} else {
					bOK = false;
					//*** Update ITEM Price Level ***
//					currentRecord.setCurrentSublistValue({
//						sublistId: 'item',
//						fieldId: 'price',
//						value: newPL
//					});
//					var sItem = currentRecord.getSublistText({
//						sublistId: 'item',
//						fieldId: 'item',
//						line: i
//					});
		    		throw error.create({
		                name: "ERROR_ITEM_PRICE_LEVEL_NOT_FOUND",
		                message: "BS_ValidatePriceLevel Customer Price Level NOT FOUND for Item: " + itemID + ", Customer Price Level: " + sPriceLevel
		                + " Customer ID: " + idCustomer + ", Subsidiary=" + Subsidiary
		            });
//					dialog.alert ({
//						title : "ERROR_ITEM_PRICE_LEVEL_NOT_FOUND",					
//						message : "Customer Price Level NOT FOUND for Item: " + sItem + ", Customer Price Level: " + sPriceLevel
//					});
				}			
	    	}
		}
        return bOK;
    }
    
    /**
     * Function definition to be triggered before record is loaded.
     * Create Progressive Leasing Record for Import web order
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function NLS_afterSubmit(scriptContext) {
    	var bOK = true;
    	var type = scriptContext.type;
    	// runtime.executionContext !== runtime.ContextType.USEREVENT
    	var curContext = runtime.executionContext;
//    	log.debug({
//			title: 'NLS_AFTERSubmit',
//			details: "type=" + type + ", curContext=" + curContext
//		});
    	
//    	if (type === scriptContext.UserEventType.CREATE || type === scriptContext.UserEventType.EDIT){
    	if (type === scriptContext.UserEventType.CREATE) {
    		// IG WEB SERVICE ONLY:     		
    		if (curContext === runtime.ContextType.WEBSERVICES) {   
//    		if (curContext === runtime.ContextType.USER_INTERFACE){
    			var curRecord = scriptContext.newRecord;

    			var objRecord = record.load({
	    		    type: record.Type.SALES_ORDER, 
	    		    id: curRecord.id,
	    		    isDynamic: true,
	    		});
    			
	    		var iChannel = objRecord.getValue('custbody_nls_channel');
	    		var newSubmitted = objRecord.getValue('custbody_nls_do_not_submit_order');	    		
	    		var obTranID = objRecord.getValue('tranid');
	    		
	    		log.debug({
	    			title: "NLS_AFTERSubmit curRecord.id=" + curRecord.id,
	    			details: "iChannel=" + iChannel + ", newSubmitted=" + newSubmitted + ', obTranID=' + obTranID
	    		});
	    		
	    		if (iChannel === CONSTANT_CHANNEL_DIRECT && !newSubmitted){
	    			var obLeasing = lib_pl.ValidateProgressiveLeasing(objRecord, addrDetails);
	    			
	    			if (obLeasing.bLeasing){
	    				var sAcctNum = objRecord.getValue('custbody_nls_pl_contract_number');
	    				if (sAcctNum){
		    	    		var obResult = lib_pl.SearchWebProgLeasingOrder(sAcctNum, curRecord.id);
		    	    		if (obResult && obResult.count > 0){
		    	    			plID = obResult.result.id;
		    	    			log.debug({
		    	        			title: "CreateProgLeasing - Update plID=" + plID,
		    	        			details:"Found Progressive Leasing Record , sAcctNum=" + sAcctNum + ", curRecord.id=" + curRecord.id
		    	        		});		    	    			
		    	    		} else {
		    	    			plID = CreateProgLeasing(objRecord, obLeasing);
		    	    		}
	    				}
	    			}
	    		}
    		}
    	}
    	return bOK;
    }
    
    /**
     * User Event - Before Submit Function
     * Old Script: NLS Gap 106 Set Ship Complete - Import
     * Old Function: SetShipComplete
     * @param currentRecord
     * @returns
     */
    function SetSettleComplete(currentRecord){
		// Check Finance Partners: custbody_nls_financing_company
		var sFinancingCo = currentRecord.getValue('custbody_nls_financing_company');
		var sPaymentMethod = currentRecord.getValue('paymentmethod');
		var sNLSPayMethod = currentRecord.getValue('custbody_nls_payment_method');
		// lib function also Set for Progressive Leasing
		// QualifyShipComplete(sPaymentMethod, sNLSPayMethod, sFinancingCo)
//		var bShipComplete = lib.QualifyShipComplete(sPaymentMethod, sNLSPayMethod, sFinancingCo);
//		currentRecord.setValue({
//			fieldId: 'shipcomplete',
//			value: bShipComplete
//		});
		// DF-9521 Direct Orders should settle complete based on payment method or finance partner 
		// Settle Complete: custbody_nls_settle_complete
		var bSettleComplete = lib.QualifySettleComplete(sPaymentMethod, sNLSPayMethod, sFinancingCo);
		currentRecord.setValue({
			fieldId: 'custbody_nls_settle_complete',
			value: bSettleComplete
		});
		log.debug({
			title: "Set Settle Complete",
			details:  "bSettleComplete=" + bSettleComplete + ", sFinancingCo=" + sFinancingCo + ", sPaymentMethod=" + sPaymentMethod + ", sNLSPayMethod=" + sNLSPayMethod
		});
		return true;
    }    
   
    /**
     * Web Import order ONLY
     * @param curRecord
     * @param sMerchandise, Account Number, isWebOrder
     * @returns Create custom record
     */
    function CreateProgLeasing(curRecord, obLeasing){
    	var sAcctNum = curRecord.getValue('custbody_nls_pl_contract_number');
    	var sEsignURL = curRecord.getValue('custbody_nls_pl_esign_url');
    	var isIGOrder = curRecord.getValue('custbody_nls_intgr_ig_order');    	
    	var oriBMID = curRecord.getValue('custbody_nls_finance_bmcustomernumber');
    	var bOK = true;
//    	if (sAcctNum && (isIGOrder || oriBMID)){
    	if (sAcctNum){
    		// Customer ID
        	var idCustomer = curRecord.getValue('entity');
        	var objLookupEntityID = search.lookupFields({
        		type: search.Type.CUSTOMER,
        		id: idCustomer,
        		columns: ['entityid']
        	});
        	var sEntityID;
	    	if (objLookupEntityID){
	    		sEntityID = objLookupEntityID.entityid;
	    	}
    		
    		log.debug({
    			title: "CreateProgLeasing",
    			details:"idCustomer=" + idCustomer + ", sEntityID=" + sEntityID + ", obLeasing.sMerchandise=" + obLeasing.sMerchandise
    		});    		
    		
    		var plID;
    		var objWS;
    		//SearchWebProgLeasingOrder(sAccountNumber, soID)
    		var obResult = lib_pl.SearchProgLeaseApplByCustNoOrder(idCustomer);
    		if (obResult && obResult.count > 0){
    			plID = obResult.result.id;
    			log.debug({
        			title: "UE_AfterSubmit CreateProgLeasing - idCustomer=" + idCustomer,
        			details:"SearchProgLeaseApplByCustNoOrder - Found plID=" + plID
        		});
    			   			
//    			bOK = lib_pl.UpdateProgressiveLeasingOrder(plID, curRecord, obLeasing, objWS);
    		} else {
    			//CreateProgressiveLeasingWebOrder(objOrder, entityID, idCustomer, obLeasing)
    			plID = lib_pl.CreateProgressiveLeasingWebOrder(curRecord, sEntityID, idCustomer, obLeasing);    			
    		}
    		log.debug({
    			title: "CreateProgLeasing AFTER",
    			details:"Progressive Leasing Record PL ID=" + plID + ', obResult.count=' + obResult.count
    		});
    	}  	
    	return plID;
    }
   
    /**
     * User Event: before Submit Function
     * Set item Tax Code based on subsidiary to Avalara Tax Codes
     * Old Script: NLS Fix AvaTax Code
     * Old Function: ChangeAvaTaxCode
     * @param curRecord
     * @returns
     */
    function FixAvaTaxCode(curRecord)
    {
		var subsidiary = curRecord.getValue('subsidiary');
		var itemCount = curRecord.getLineCount('item');			

		if (subsidiary) {
			//*** Part 1: Line Item					
			for (var i = 0; i < itemCount; i++) {
				// Only commit item line when Taxable code is defaulted wrong with subsidiary
				var bCommitLine = false;
				// Default Tax Code to US Non-Taxable				
				var sTaxCode = CONSTANT_NotTaxable_US;
				if (subsidiary === CONSTANT_SUBSIDIARY_CA){
					sTaxCode = CONSTANT_NotTaxable_CAN;
				}			
				
				var itemTaxCode = curRecord.getSublistValue({
					sublistId: 'item', 
					fieldId: 'taxcode',
					line: i    					
				});
				var spTaxCode = curRecord.getSublistValue({
					sublistId: 'shipgroup', 
					fieldId: 'shippingtaxcode',
					line: i
				});				
				
				if (subsidiary === CONSTANT_SUBSIDIARY_US && (itemTaxCode == CONSTANT_TAXCODE_CCH_US || itemTaxCode == CONSTANT_NotTaxable_CAN)) {
					// US					
					sTaxCode = CONSTANT_TAXCODE_AVATAX_US;
					bCommitLine = true;
				}
				else 
					if (subsidiary === CONSTANT_SUBSIDIARY_CA && (itemTaxCode == CONSTANT_TAXCODE_CCH_CAN || itemTaxCode == CONSTANT_NotTaxable_US)) {
						// CANADA
						sTaxCode = CONSTANT_TAXCODE_AVATAX_CAN;
						bCommitLine = true;
					}
				
				if (bCommitLine == true){
					log.debug({
						title: 'BeforeSubmit FixAvaTaxCode',
						details: "Line Tax Codes Line=" + i + ", itemTaxCode = " + itemTaxCode + ", spTaxCode= " + spTaxCode + ", bCommitLine=" + bCommitLine
					});
					curRecord.selectLine({
						sublistId: 'item',
						line: i
					});
					curRecord.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'taxcode',
						value: sTaxCode
					});
					curRecord.commitLine({
						sublistId: 'item'
					});
				}
			}
		}
    }      
	
	function PL_CreatePL_SubmitInvoice(currentRecord) {
		// BEFORE SUBMIT - Save & Submit ONLY
		var yesCreatePL = false;
		var yesSubmitOrder = false;	
		var bCallPL = false;	
		var sErrorMsg = '';
		// LOAD SO - Dynamic
		var objRecord = record.load({
		    type: record.Type.SALES_ORDER, 
		    id: currentRecord.id,
		    isDynamic: true,
		});
		var objLeasing = lib_pl.ValidateProgressiveLeasing(objRecord, addrDetails);
		if (objLeasing && objLeasing.bOK){
			log.debug({
				title: 'PL_SubmitInvoice_bOK',
				details: "objLeasing.bLeasing=" + objLeasing.bLeasing + ", objLeasing.sErrorMessage=" + objLeasing.sErrorMessage + ", bSaveCalculate=" + objLeasing.bSaveCalculate + ", objLeasing.bSubmitOrder=" + objLeasing.bSubmitOrder
			});			
			
	    	if (objLeasing.bLeasing && objLeasing.bSaveCalculate && objLeasing.bSubmitOrder){
	    		// Create Progressive Leasing Record
	    		yesCreatePL = true;
	    		yesSubmitOrder = objLeasing.bSubmitOrder;
	    	} else {
	    		if (objLeasing.sErrorMessage){
	    			sErrorMsg = objLeasing.sErrorMessage;
	    		}
	    		if (objLeasing.sErrorCode){
	    			sErrorMsg = sErrorMsg + ", Error Code=" + objLeasing.sErrorCode;
	    		}
	    	}
		
			if (yesCreatePL && yesSubmitOrder && objLeasing.sMerchandise){				
				log.debug({
					title: 'PL_SubmitInvoice_YES',
					details: "yesSubmitOrder=" + yesSubmitOrder + ", objLeasing.sMerchandise=" + objLeasing.sMerchandise
				});
	    		// 1. if eSignURL is blank
	    		var plAcctNum = currentRecord.getValue('custbody_nls_pl_contract_number');
	    		var hasEsignURL = currentRecord.getValue('custbody_nls_pl_esign_url');
	    		var fCreditLimit = currentRecord.getValue('custbody_nls_pl_credit_line');
	    		
	    		var plID;        		
	    		log.debug({
					title: 'PL_SubmitInvoice_2',
					details: "plAcctNum=" + plAcctNum + ", hasEsignURL=" + hasEsignURL
				});
	    		var idSO = currentRecord.id; 
    			var idCustomer = currentRecord.getValue('entity');
    			if (hasEsignURL){
    				var sDetails = "Remove eSign URL to send a new contract."; 
					sErrorMsg = sErrorMsg + sDetails;
					log.error({
						title: "Progressive_Order_ERROR",
						details: sDetails
					});
    			} else if (idSO && idCustomer && fCreditLimit && plAcctNum) {
	    			//#1. Search Progressive Leasing by Account #
    				var resultPLAcctNum = lib_pl.SearchProgLeasingByAccountNum(plAcctNum);
    				
    				if (resultPLAcctNum && resultPLAcctNum.count > 0){
    					var plCount = resultPLAcctNum.count;
    					
						var foundCust = resultPLAcctNum.result.getValue('custrecord_nls_pl_customer');
						var foundEntityID = resultPLAcctNum.result.getValue('custrecord_nls_pl_entity_id');
						var foundSO = resultPLAcctNum.result.getValue('custrecord_nls_pl_sales_order');
						var foundSOID = resultPLAcctNum.result.getValue('custrecord_nls_pl_order_id');
						
						var curTranID = objRecord.getValue('tranid');
						
						log.debug({
    						title: "SearchProgLeasingByAccountNum plAcctNum: " + plAcctNum + ", curTranID=" + curTranID,
    						details: "resultPLAcctNum foundCust= " + foundCust + ", foundEntityID=" + foundEntityID + ", foundSO=" + foundSO + ", foundSOID=" + foundSOID + ", plCount=" + plCount
    					});
						
						if (foundCust && idCustomer === foundCust) {
							// Customer match
							if (plCount === 1){
								// Same Customer - No Sales Order
								if (!foundSO){
									plID = resultPLAcctNum.result.id;
								} else {
									// Same customer - has Sales Order
									if (idSO == foundSO || curTranID === foundSOID){
										// Update the same Sales Order
										plID = resultPLAcctNum.result.id;
									} else {
										// Different Sales Order - DO NOT SUBMIT ORDER
										var sDetails = "Lease ID: " + plAcctNum + " is used for another order, idSO=" + idSO + ", foundSO=" + foundSO + ", found Cust=" + foundCust + ", idCustomer=" + idCustomer;
										sErrorMsg = sErrorMsg + sDetails;
										log.error({
				    						title: "ERROR SearchProgLeasingByAccountNum plAcctNum: " + plAcctNum,
				    						details: sErrorMsg
				    					});										
									}
								}
								log.debug({
		    						title: "Found Progressive plAcctNum: " + plAcctNum,
		    						details: "resultPLAcctNum plID= " + plID + ", foundSOID= " + foundSOID + ", curTranID=" + curTranID + ", plCount=" + plCount
		    					});
							
							} else {
								// Customer has more than 1 Approved Leasing IDs
								log.debug({
		    						title: "Progressive plAcctNum: " + plAcctNum,
		    						details: "Customer has " + plCount + " PL records, foundSOID= " + foundSOID + ", curTranID=" + curTranID + ", foundEntityID=" + foundEntityID
		    					});								
			    				
		    					//#2. Search Progresslive Leasing by Account Number & idSO
		    					var objSOResult = lib_pl.SearchProgLeasingSubmitOrder(plAcctNum, idSO);
		    					
		    					if (objSOResult && objSOResult.count > 0){
		    						var fCust = objSOResult.result.getValue('custrecord_nls_pl_customer');
									var fEntityID = objSOResult.result.getValue('custrecord_nls_pl_entity_id');
									var fSO = objSOResult.result.getValue('custrecord_nls_pl_sales_order');
									var fSOID = objSOResult.result.getValue('custrecord_nls_pl_order_id');
									var plCountSO = objSOResult.count;
									
									log.debug({
			    						title: "SearchProgLeasingSubmitOrder objSOResult.result.id: " + objSOResult.result.id,
			    						details: "objSOResult idSO= " + idSO + ", fEntityID=" + fEntityID + ", fCust=" + fCust + ", fSO=" + fSO + ", fSOID=" + fSOID + ", plCountSO=" + plCountSO
			    					});
									if (fCust && fSO && fCust === idCustomer && fSO === idSO){
										// Update existing PL with SO
										plID = objSOResult.result.id;
									} else {
										var sDetails = "PL ERROR Lease ID: " + plAcctNum + " is used for " + plCountSO + " orders, idSO= " + idSO + ", found SO=" + fSO + ", found Cust=" + fCust + ", idCustomer=" + idCustomer;
										sErrorMsg = sErrorMsg + sDetails;
										log.error({
				    						title: "ERROR SearchProgLeasingSubmitOrder plAcctNum: " + plAcctNum,
				    						details: sDetails
				    					});
									}
		    					} else {
		    						var sDetails = "UNKNOWN ERROR SearchProgLeasingSubmitOrder Lease ID: " + plAcctNum + " Search Result: idSO= " + idSO + ", objSOResult=" + objSOResult;
									sErrorMsg = sErrorMsg + sDetails;
		    						log.error({
			    						title: "UNKNOWN ERROR SearchProgLeasingSubmitOrder plAcctNum: " + plAcctNum,
			    						details: sDetails
			    					});
		    					}
			    				
							} 
						} else {
							// Wrong Customer !!!
							var sDetails = "ERROR!  Progressive Lease ID: " + plAcctNum + " has been used for another customer on file - foundCust=" + foundCust + ", foundEntityID=" + foundEntityID + ", idCustomer=" + idCustomer;
							sErrorMsg = sErrorMsg + sDetails;
							log.error({
	    						title: "ERROR! Progressive plAcctNum: " + plAcctNum,
	    						details: sDetails
	    					});							
						}
					} else {
						// New Account Number - Create new PL
						plID = CreateProgLeasing(objRecord, objLeasing);
					}
	    		} else {
	    			// Required: idSO && idCustomer && plAcctNum && !hasEsignURL && fCreditLimit
	    			var sDetails = "Invalid Field Values: Progressive Lease ID: " + plAcctNum + ", fCreditLimit=" + fCreditLimit + ", idSO= " + idSO + ", idCustomer=" + idCustomer;
					sErrorMsg = sErrorMsg + sDetails;
					log.error({
						title: "Progressive_Order_ERROR",
						details: sDetails
					});
	    		}
	    		
	    		// 2. Save & Submit   		
	    		if  (yesSubmitOrder && plID) {
	    			if (objLeasing.bSaveCalculate && objLeasing.bLeasing && objLeasing.bSubmitOrder){
	    				bCallPL = submitInvoiceInfo_PL(currentRecord, objLeasing, plID);
	    				log.debug({
	        				title: "Submit Order bCallPL=" + bCallPL,
	        				details: "idSO= " +idSO + ", plID=" + plID
	        			});
	    			} else {
	    				// DF-11934 Store error message on SO if eSign URL is not returned at Save and Submit
	    				if (sErrorMsg){
	    					currentRecord.setValue({
								fieldId: 'custbody_nls_pl_so_error_msg',
								value: sErrorMsg
							});	
		    			}
	    				log.debug({
	        				title: "Not Submit Order",
	        				details: "objLeasing.bLeasing=" + objLeasing.bLeasing + ", objLeasing.bSubmitOrder=" + objLeasing.bSubmitOrder + "objLeasing.bSaveCalculate= " + objLeasing.bSaveCalculate
	        			});
	    			}
	    		} else {
	    			// DF-11934 Store error message on SO if eSign URL is not returned at Save and Submit
	    			if (sErrorMsg){
	    				currentRecord.setValue({
							fieldId: 'custbody_nls_pl_so_error_msg',
							value: sErrorMsg
						});	
	    			}
	    			log.debug({
	    				title: "Not Submit Order",
	    				details: "yesSubmitOrder= " + yesSubmitOrder + ", plID=" + plID + ", " + sErrorMsg
	    			});
	    		}
			}
    	}
    	return true;
	}
	
	function submitInvoiceInfo_PL(curRecord, objLeasing, idPL){
    	var bOK = true;
    	var sCustID = curRecord.getText('entity');
    	var sAcctNum = curRecord.getValue('custbody_nls_pl_contract_number');
    	var sEsignURL = curRecord.getValue('custbody_nls_pl_esign_url');    	
    	
    	// Before Submit - eSign URL is BLANK
    	if (!sAcctNum || !sCustID || sEsignURL) {
    		bOK = false;
//    		alert("Invalid Account Number sAcctNum=" + sAcctNum + ', sCustID=' + sCustID + ", sEsignURL=" + sEsignURL + ', sOrderID=' + sOrderID);
    		log.error({
				title: "submitInvoiceInfo_PL",
				details: "sCustID=" + sCustID + ", sAcctNum=" + sAcctNum + ", sEsignURL=" + sEsignURL
			});		
    	}
    	var sOrderID = curRecord.getValue('tranid');    	
    	var iPLItemCount = curRecord.getLineCount('item');
    	
    	if (bOK && sOrderID && iPLItemCount > 0 && !sEsignURL){
	    	//*** HARD CODED ***  '5097773'    	
    		// In Process: 5165615
//    		sAcctNum = '5165615'
//    		sAcctNum = '5135225';
    		//*** HARD CODED ***
    		var fTotalAmount = curRecord.getValue('total');
        	var fTaxTotal = curRecord.getValue('taxtotal');
        	var fShipTotal = curRecord.getValue('shippingcost');
        	if (!fShipTotal){
        		fShipTotal = 0;
        	}
        	
        	var today = new Date();
        	var month = ("00" + (today.getMonth() + 1)).slice(-2);
        	var tDate = ("00" + (today.getDate())).slice(-2);
        	var dOrderDate = today.getFullYear() + '-' + month + '-' + tDate;    	
        	
        	log.debug({
				title: "submitInvoiceInfo_PL iPLItemCount=" + iPLItemCount,
				details: "today=" + today + ", month=" + month + ", tDate=" + tDate + ", dOrderDate=" + dOrderDate + ", fTotalAmount=" + fTotalAmount + ", fTaxTotal=" + fTaxTotal
			});
        	
	    	var sInData = '<SourceSystem>OM</SourceSystem><FinanceCompany>Progressive</FinanceCompany>';
	    	sInData += '<CustomerID></CustomerID><AccountNumber></AccountNumber><OrderID></OrderID>';
	    	sInData += '<TotalAmount></TotalAmount><ShippingAmount></ShippingAmount><Tax></Tax><OrderDate></OrderDate>';
	    	sInData += '<Merchandise>';
			// Order Line Items <Merchandise> <MerchandiseItem>:
	    	var sMerchandise = '';
    		for (var i = 0; i < iPLItemCount; i++){
    			var stItemType = curRecord.getSublistValue({
    				sublistId : 'item',
    				fieldId : 'itemtype',
    				line : i
    			});
    					
            	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
            		// Skip
            	} else {
            		var stItem = curRecord.getSublistText({
        				sublistId : 'item',
        				fieldId : 'item',
        				line : i
        			});
            		var iQty = curRecord.getSublistValue({
        				sublistId : 'item',
        				fieldId : 'quantity',
        				line : i
        			});
            		var fUnitPrice = curRecord.getSublistValue({
            			sublistId : 'item',
            			fieldId : 'rate',
            			line : i
            		});
            		sMerchandise += stItem + ':' + iQty + ', ';
            		var sMerchandiseItem = '<MerchandiseItem>';
            		sMerchandiseItem += '<Description>' + stItem + '</Description>';
            		sMerchandiseItem += '<PriceEach>' + fUnitPrice + '</PriceEach>';
            		sMerchandiseItem += '<Quantity>' + iQty + '</Quantity></MerchandiseItem>';
            		sInData += sMerchandiseItem;
            	}
    		}
    		sInData += '</Merchandise>'; 
    		
    		var sEnv = runtime.envType;
			// Build Router Financing request XML: Credential + Action + FinanceCompany
			var strRequestBody = nls_ws.BuildFinanceRequestXML(sEnv, 'SubmitOrderInformation', sInData);
			// Set Header value:
			strRequestBody = nls_ws.setRequestNodeValue(strRequestBody, 'Request/Data/CustomerID', sCustID);
			strRequestBody = nls_ws.setRequestNodeValue(strRequestBody, 'Request/Data/AccountNumber', sAcctNum);
			strRequestBody = nls_ws.setRequestNodeValue(strRequestBody, 'Request/Data/OrderID', sOrderID);
			strRequestBody = nls_ws.setRequestNodeValue(strRequestBody, 'Request/Data/TotalAmount', fTotalAmount);
			strRequestBody = nls_ws.setRequestNodeValue(strRequestBody, 'Request/Data/ShippingAmount', fShipTotal);
			strRequestBody = nls_ws.setRequestNodeValue(strRequestBody, 'Request/Data/Tax', fTaxTotal);
			strRequestBody = nls_ws.setRequestNodeValue(strRequestBody, 'Request/Data/OrderDate', dOrderDate);
			
			sURL = nls_ws.GetNLSRouterURL(sEnv);
			
	//		var oResponse = nlapiRequestURL(sURL, strRequestBody, null);
//				alert('strRequestBody=' + strRequestBody);
			var oResponse = https.post({
				url: sURL,
				body: strRequestBody
			});

			var body = oResponse.body;
			var headers = oResponse.headers;
			var output = oResponse.code;
			
			var respSubmitOrderInfo = nls_ws.processProgLeaseResp_SubmitOrder(body);
			
			var objWS = new Object();			
			objWS.status = respSubmitOrderInfo.status;			
			objWS.responseXML = body;  
			objWS.requestXML = strRequestBody;
			
			if (respSubmitOrderInfo && respSubmitOrderInfo.status){
				if (respSubmitOrderInfo.status === 'Success') {
					var sNewEsignURL= respSubmitOrderInfo.eSignURL;
									
					if (bOK && sNewEsignURL){
						// Update Sales Order URL
						curRecord.setValue({
							fieldId: 'custbody_nls_pl_esign_url',
							value: sNewEsignURL
						});
						// Clear Error MSG
						// DF-11934 Store error message on SO if eSign URL is not returned at Save and Submit
						curRecord.setValue({
							fieldId: 'custbody_nls_pl_so_error_msg',
							value: ''
						});
						// Update Progressive Leasing Record
						bOK = lib_pl.UpdateProgressiveLeasingSubmitOrder(idPL, curRecord, objLeasing, objWS, today);
						log.debug({
							title: "Update Progressive Leasing idPL=" + idPL,
							details: "Order submitted to Progressive Leasing successfully with URL=" + respSubmitOrderInfo.eSignURL
						});
//						alert('Order submitted to Progressive Leasing successfully with URL: \n' + respSubmitOrderInfo.eSignURL);
					}
				}
				else {
					objWS.errorMessage = respSubmitOrderInfo.errorSource;
		    		objWS.ErrorCode = respSubmitOrderInfo.errorNumber;
		    		
					bOK = lib_pl.UpdateProgressiveLeasingOrder(idPL, curRecord, objLeasing, objWS);
					log.error({
						title: "Unable to submit order to Progressive Leasing idPL=" + idPL,
						details: "respSubmitOrderInfo.errorSource=" + respSubmitOrderInfo.errorSource
					});
//					alert(respSubmitOrderInfo.status + "!  Unable to submit order to Progressive Leasing idPL=" + idPL + '\n' + respSubmitOrderInfo.errorSource);
					//*** Before Submit Save & Submit - Update Sales Order URL
					var sErrMsg = '';
					if (respSubmitOrderInfo.errorSource){
						sErrMsg = respSubmitOrderInfo.errorSource;
					}
					if (respSubmitOrderInfo.errorNumber){
						sErrMsg = sErrMsg + " ErrCode: " + respSubmitOrderInfo.errorNumber;						
					}
					// DF-11934 Store error message on SO if eSign URL is not returned at Save and Submit
					curRecord.setValue({
						fieldId: 'custbody_nls_pl_so_error_msg',
						value: sErrMsg
					});	
				}
			}
    	}
    	return bOK;
    }
	
    return {
//        beforeLoad: NLS_beforeLoad,
        beforeSubmit: NLS_beforeSubmit,
        afterSubmit: NLS_afterSubmit
    };
    
});
