/** *
 * DF-10798 Retail orders are not getting approved by 181 when there is a hold
 * DF-10684 Script 181 Approval saved search needs sort logic added
 * DF-10686 � Script 181 Create Fulfillment saved search needs to remove hold criteria
* DF-10687 � Script 181 Create Fulfillment script needs hold parameters added back
* DF-10688 - � Script 181 Create Fulfillment script needs to have the Max/no max deployments combined
* DF-10673 General Hold adding 2 hold exempts: Verify Payment, E Consent - Approve SO
* DF-9664 Create a deployment of 181 for drop ship orders and Retail LTL
* DF-10325 Create a new deployment for Retail LTL orders in 181
* DF-10604 Create separate deployments of 181 - Split into 2 scripts
* DF-9588 Create fulfillment flag getting checked prior to an order being placed on hold
* Change search API, Remove load SO API, Remove DoSourcing in Submit Record API
* LAST MODIFIED: 8/30/2016, 9/12/2016, 10/4/2016
* BY KCHANG 
 */

var CHANNEL_DIRECT = '1';
var CHANNEL_RETAIL = '2';
var STATUS_PENDINGFULFILL = 'B';
var HOLDSTATUS_ONHOLD = '2';
var arrExemptHolds = [];
/**
 * Original Script: 
 * NS | Gap 181 - Set Create Fulfillment (ID=customscript_set_create_fulfillment)
 * New Scripts: 
 * 1. NLS SS 181 Approve Sales Order
 * 2. NLS SS 181 Set Create Fulfillment Flag
 */

function scheduled_ApproveSO()
{
	// New Script 181 - Approve Sales Order: * DF-10604 Create separate deployments of 181
    var stLoggerTitle = 'scheduled_ApproveSO';
    try
    {
		var deployID = nlapiGetContext().getDeploymentId();
		var scriptID = nlapiGetContext().getScriptId();
        nlapiLogExecution('DEBUG', stLoggerTitle, '--- START --- ScriptID = ' + scriptID + ', Deployment ID: ' + deployID);
		
		var stVerifyPaymentHold    = nlapiGetContext().getSetting('SCRIPT','custscript_verify_payment_hold_ex');
        var stEConsentHold         = nlapiGetContext().getSetting('SCRIPT','custscript_econsent_hold_ex');
        var stSOPendApprovalSearch = nlapiGetContext().getSetting('SCRIPT','custscript_ss181_pendapproval');
        var intSearchLastSOId1     = parseInt(nlapiGetContext().getSetting('SCRIPT','custscript_approve_last_soid')) || 0;
      
	  	// DF-10684 REMOVE SORTING and RE-scheduling Function
        var arrSchedParams = new Array();
        arrSchedParams['custscript_ss181_pendapproval'] = stSOPendApprovalSearch;
		arrSchedParams['custscript_verify_payment_hold'] = stVerifyPaymentHold;
        arrSchedParams['custscript_econsent_hold'] = stEConsentHold;
		arrSchedParams['custscript_approve_last_soid'] = 0;
		
		// Exempt Holds
		var arrExemptHolds = [];
        if(stVerifyPaymentHold) arrExemptHolds.push(stVerifyPaymentHold);
        if(stEConsentHold) arrExemptHolds.push(stEConsentHold);                
       
        if(!stSOPendApprovalSearch)
        {
			nlapiLogExecution('ERROR', stLoggerTitle, 'SCRIPT EXIT!  Script saved search is empty stSOPendApprovalSearch=' + stSOPendApprovalSearch);
			return;            
        }
        if (stSOPendApprovalSearch) {			
			var bReSchedule = ApproveSalesOrder(arrSchedParams, intSearchLastSOId1, stSOPendApprovalSearch, arrExemptHolds);
			//*** DF-10684 REMOVE SORTING and RE-scheduling Function
//			nlapiLogExecution('DEBUG', stLoggerTitle, 'bReSchedule = ' + bReSchedule);
			if (bReSchedule == true) {
//				nlapiLogExecution('AUDIT', stLoggerTitle, 'intSearchLastSOId1 = ' + arrSchedParams['custscript_approve_last_soid']);
//				
//				var stSchedStatus = nlapiScheduleScript(nlapiGetContext().getScriptId(), nlapiGetContext().getDeploymentId(), arrSchedParams);
				nlapiLogExecution('ERROR', stLoggerTitle, 'Unfinished Scheduled Script Due To Usage Limit: Scheduled Script bReSchedule = ' + bReSchedule + ', intSearchLastSOId1=' + intSearchLastSOId1);
//				return;
			}
		}
    } catch (error) {
        if (error.getDetails != undefined)
        {
            nlapiLogExecution('ERROR','Process Error',error.getCode() + ': ' + error.getDetails());
            throw error;
        }
        else
        {
            nlapiLogExecution('ERROR','Unexpected Error',error.toString());
            throw nlapiCreateError('99999', error.toString());
        }
    }
	nlapiLogExecution('DEBUG', stLoggerTitle, '--- End --- APPROVE SALES ORDER ---');
}

function scheduled_SetLineCreateFulfillFlag()
{
	// New Script 181 Set Create Fullfillment Order: * DF-10604 Create separate deployments of 181
    var stLoggerTitle = 'scheduled_SetLineCreateFulfillFlag';
    try
    {
		var deployID = nlapiGetContext().getDeploymentId();
		var scriptID = nlapiGetContext().getScriptId();
        nlapiLogExecution('DEBUG', stLoggerTitle, '--- START --- ScriptID = ' + scriptID + ', Deployment ID: ' + deployID);

        var stSOByItemSearch       = nlapiGetContext().getSetting('SCRIPT','custscript_ss181_byitem');
        var intSearchLastSOId2     = parseInt(nlapiGetContext().getSetting('SCRIPT','custscript_fulfill_last_soid')) || 0;
        
        var arrSchedParams = new Array();
        arrSchedParams['custscript_ss181_byitem'] = stSOByItemSearch;
        arrSchedParams['custscript_fulfill_last_soid'] = 0;
		
        if(!stSOByItemSearch)
        {
			nlapiLogExecution('ERROR', stLoggerTitle, 'SCRIPT EXIT!  Script saved search is empty stSOByItemSearch=' + stSOByItemSearch);
            return; 
        }
        if (stSOByItemSearch) {			
			var bReSchedule = setCreateFulfillmentFlag(arrSchedParams, intSearchLastSOId2, stSOByItemSearch, arrExemptHolds);
			//*** DF-10684 REMOVE SORTING and RE-scheduling Function
//			nlapiLogExecution('DEBUG', stLoggerTitle, 'bReSchedule = ' + bReSchedule);			
			if (bReSchedule == true) {
//				nlapiLogExecution('AUDIT', stLoggerTitle, 'intSearchLastSOId2 = ' + arrSchedParams['custscript_fulfill_last_soid']);
//				
//				var stSchedStatus = nlapiScheduleScript(nlapiGetContext().getScriptId(), nlapiGetContext().getDeploymentId(), arrSchedParams);
				nlapiLogExecution('AUDIT', stLoggerTitle, 'Unfinished Scheduled Script Due To Usage Limit: Scheduled Script bReSchedule = ' + bReSchedule + ', intSearchLastSOId2=' + intSearchLastSOId2);
//				return;
			}
		}
    } catch (error) {
        if (error.getDetails != undefined)
        {
            nlapiLogExecution('ERROR','Process Error',error.getCode() + ': ' + error.getDetails());
            throw error;
        }
        else
        {
            nlapiLogExecution('ERROR','Unexpected Error',error.toString());
            throw nlapiCreateError('99999', error.toString());
        }
    }
	nlapiLogExecution('DEBUG', stLoggerTitle, '--- End --- SET CREATE FULFILLMENT ORDER ---');
}

function ApproveSalesOrder(arrSchedParams,intSearchLastSOId1,stSOPendApprovalSearch,arrExemptHolds)
{
	//*** DF-10604 Split
    var stLoggerTitle = 'ApproveSalesOrder';
    var bReSchedule = false;
    var USAGE_LIMIT_THRESHOLD = 60;
    
    var filters = [];
    filters.push(new nlobjSearchFilter('internalidnumber',null,'greaterthanorequalto',intSearchLastSOId1)); 
        
    var columns = [];
	//*** DF-10684 Sort logic in saved search - DO NOT sort agian by Internal ID	
//    columns.push(new nlobjSearchColumn('internalid',null,'GROUP').setSort());      
	columns.push(new nlobjSearchColumn('internalid',null,'GROUP'));   
	
	var results = getSavedSearchResult('salesorder', stSOPendApprovalSearch, filters, columns);
	
    if(results)
    {
        nlapiLogExecution('DEBUG',stLoggerTitle,'results.length = ' + results.length);
        for (var i = 0; i < results.length; i++) 
        {
			var stSalesOrderId;
            try 
            {
                var intRemainingUsage = nlapiGetContext().getRemainingUsage();
                nlapiLogExecution('DEBUG', stLoggerTitle, '[' + i + '] Remaining Usage = ' + intRemainingUsage);

                stSalesOrderId = results[i].getValue('internalid',null,'GROUP');
				var stSOID = results[i].getValue('tranid',null,'GROUP');                
                var sChannel = results[i].getValue('custbody_nls_channel',null,'GROUP'); 
				
                arrSchedParams['custscript_approve_last_soid'] = stSalesOrderId;
                
                if (intRemainingUsage < USAGE_LIMIT_THRESHOLD) {
                    bReSchedule = true;
                    break;
                }
                
//				var createdDate = nlapiLookupField('salesorder', stSalesOrderId,'trandate');
				if (stSalesOrderId) {
					nlapiLogExecution('DEBUG', stLoggerTitle, '[' + i + '] stSalesOrderId = ' + stSalesOrderId + ', stSOID=' + stSOID + ', sChannel=' + sChannel);
					//*** DF-10673 Adding Search General Hold
					var bHasNoGeneralHolds = false;
					if (sChannel == CHANNEL_DIRECT) {
						// With Exempt Hold
						bHasNoGeneralHolds = searchGeneralHolds(stSalesOrderId,arrExemptHolds);
					}
					else {
						//*** DF-10798 Retail orders are not getting approved by 181 when there is a hold
						// No exempt Hold
//						var arrNoExempt=[];
//						bHasNoGeneralHolds = searchGeneralHolds(stSalesOrderId,arrNoExempt);
						bHasNoGeneralHolds = true;
					}
					
					if (bHasNoGeneralHolds == true) {
						stSalesOrderId = nlapiSubmitField('salesorder', stSalesOrderId, 'orderstatus', STATUS_PENDINGFULFILL);
						nlapiLogExecution('AUDIT', stLoggerTitle, '[' + i + '] Sales Order APPROVED!  SO ID = ' + stSalesOrderId + ', stSOID=' + stSOID);
					} else {
						nlapiLogExecution('DEBUG', stLoggerTitle, '[' + i + '] Sales Order has HOLD!  SO ID = ' + stSalesOrderId + ', stSOID=' + stSOID);
					}
					//*** DF-10673 Adding Search General Hold
				}
            }
            catch (error) 
            {
                var stError = (error.getDetails != undefined) ? error.getCode() + ': ' + error.getDetails() : error.toString();
                nlapiLogExecution('ERROR', stLoggerTitle, '[' + i + '] Error Occurred, Reason = ' + stError);
            }
        }    
    }    
    return bReSchedule;  
}

function setCreateFulfillmentFlag(arrSchedParams,intSearchLastSOId2,stSOByItemSearch)
{
	// *** DF-9588 *** Check Finance Authorization Code
	// *** DF-10604 *** RCRD_HAS_BEEN_CHANGED
	// *** DF-10867 ***	
	var arrExemptHolds = [];
    var stLoggerTitle = 'setCreateFulfillmentFlag';           
    var bReSchedule = false;
    var USAGE_LIMIT_THRESHOLD = 60;    
    var arrOrderHasUpdate = [];    
    var filters = [];
	var tStart = new Date().getTime();
	
    filters.push(new nlobjSearchFilter('internalidnumber',null,'greaterthanorequalto',intSearchLastSOId2)); 
        
    var columns = [];
	//*** DF-10684 Sort logic in saved search - DO NOT sort again by Internal ID
//    columns.push(new nlobjSearchColumn('internalid',null,'GROUP').setSort()); 
    columns.push(new nlobjSearchColumn('internalid',null,'GROUP'));
	
	var results = getSavedSearchResult('salesorder', stSOByItemSearch, filters, columns);
	
    if(results)
    {
		var iTotalOrderLineCount = results.length; 
        nlapiLogExecution('DEBUG',stLoggerTitle,'BEGIN - Saved Search Results, iTotalOrderLineCount= ' + iTotalOrderLineCount + ' order lines, tStart=' + tStart);
       
		if (iTotalOrderLineCount > 0) {
			var stStartingInternalId = '';
			var recSalesOrder;
//			var lastID = results[iTotalOrderLineCount-1].getValue('internalid'); 
			var lastID = results[iTotalOrderLineCount-1].getValue('internalid', null, 'GROUP');
			var nextID = lastID;
			nlapiLogExecution('DEBUG', 'Before i Loop', 'iTotalOrderLineCount=' + iTotalOrderLineCount + ', lastID=' + lastID + ', nextID=' + nextID);
			
			for (var i = 0; i < results.length; i++) {
				try {
					var intRemainingUsage = nlapiGetContext().getRemainingUsage();
					var tNow = new Date().getTime();
					var executeTime = tNow - tStart;
					nlapiLogExecution('DEBUG', stLoggerTitle, '[i=' + i + '] Remaining Usage = ' + intRemainingUsage + ', tNow=' + tNow + ', executeTime=' + executeTime + ', nextID=' + nextID);
					
//					var stSalesOrderId = results[i].getValue('internalid', null, 'GROUP');
					var stSalesOrderId = results[i].getValue('internalid', null, 'GROUP');
					var stSOID = results[i].getValue('tranid', null, 'GROUP');
					
					nlapiLogExecution('AUDIT', stLoggerTitle, '[i=' + i + '] stSalesOrderId = ' + stSalesOrderId + ', stSOID=' + stSOID);
					//*** Script EXIT when Remaining Usage Units < 60 Units  AND Time > 15 minutes
					if (intRemainingUsage < USAGE_LIMIT_THRESHOLD || executeTime > 900000) {
						arrSchedParams['custscript_fulfill_last_soid'] = stSalesOrderId;
						bReSchedule = true;
						break;
					}					
					
					if (stSalesOrderId && stStartingInternalId != stSalesOrderId) {				
						//*** Initialize sales order variables 
						var bFinanceOK = true;
						var bHasNoGeneralHolds = true;
						stStartingInternalId = stSalesOrderId;
						
						// *** Load Sales Order ***
						recSalesOrder = nlapiLoadRecord('salesorder', stStartingInternalId);
						// DF-9588 Create fulfillment flag getting checked prior to an order being placed on hold
						if (recSalesOrder) {
							
							// ***DF-10686 General Hold Search *******							
							bHasNoGeneralHolds = searchGeneralHolds(stStartingInternalId, arrExemptHolds);
							nlapiLogExecution('DEBUG', stLoggerTitle, 'Loading Sales Order: ' + stSOID + ', stStartingInternalId=' + stStartingInternalId + ', bHasNoGeneralHolds=' + bHasNoGeneralHolds);
							if (bHasNoGeneralHolds == false) {
								nlapiLogExecution('ERROR', stLoggerTitle, 'NEW Hold found on Approved Sales Order: ' + stSOID + ', stStartingInternalId=' + stStartingInternalId + ', bHasNoGeneralHolds=' + bHasNoGeneralHolds);
							}
							// *** DF-9588 Finance Auth Check
							// DF-10867 Check General Hold for All Order Line - NOT just Financing
							var sPaymentMethod = recSalesOrder.getFieldValue('paymentmethod');
							var sFinanceAuth = recSalesOrder.getFieldValue('custbody_nls_finance_auth_code');
							if (sPaymentMethod == '14' && !sFinanceAuth) {
								//*** DF-9588 Financing Authorizaion Code is BLANK??
								bFinanceOK = false;
							}
							arrOrderHasUpdate[stSalesOrderId] = false;
							nlapiLogExecution('DEBUG', stLoggerTitle, 'bFinanceOK=' + bFinanceOK + ', sPaymentMethod=' + sPaymentMethod + ', sFinanceAuth=' + sFinanceAuth);
						// *** DF-9588 Create fulfillment flag getting checked prior to an order being placed on hold
						}
					}
					
					if (bHasNoGeneralHolds == true && bFinanceOK == true) {
						var sItem = results[i].getValue('item', null, 'GROUP');
						var stLineId = results[i].getValue('line', null, 'GROUP');
						//	var stShipComplete = recSalesOrder.getFieldValue('shipcomplete');						
						var iCount = recSalesOrder.getLineItemCount('item');
						for (var line = 1; line <= iCount; line++) {
							var stCurrLineId = recSalesOrder.getLineItemValue('item', 'id', line);
							var stCurrLineNum = recSalesOrder.getLineItemValue('item', 'line', line);
							var sCurItem = recSalesOrder.getLineItemValue('item', 'item', line);
//							nlapiLogExecution('DEBUG', 'Line Items', '[' + line + '] stCurrLineNum = ' + stCurrLineNum + ', stCurrLineId=' + stCurrLineId + ', stLineId=' + stLineId + ', sCurItem=' + sCurItem + ', sItem=' + sItem); 
							
							if (sCurItem == sItem && stLineId == stCurrLineNum) {
								var intQtyBackOrdered = parseInt(recSalesOrder.getLineItemValue('item', 'quantitybackordered', line)) || 0;
								nlapiLogExecution('DEBUG', 'Items Match - CreateFulfill', '[line=' + line + '] intQtyBackOrdered = ' + intQtyBackOrdered + ', stCurrLineNum = ' + stCurrLineNum + ', sCurItem=' + sCurItem + ', sItem=' + sItem);
								
								// if(!(stShipComplete == 'T' && intQtyBackOrdered > 0))
								if (intQtyBackOrdered == 0) {
									recSalesOrder.setLineItemValue('item', 'custcol_create_fulfillment_order', line, 'T');
									recSalesOrder.commitLineItem('item');
									arrOrderHasUpdate[stSalesOrderId] = true;
								}
							}
						}
						
						if (i < iTotalOrderLineCount - 1) {
							nextID = results[i + 1].getValue('internalid', null, 'GROUP');
							nlapiLogExecution('DEBUG', 'Submit Record? i=' + i, 'nextID=' + nextID + ', stSalesOrderId=' + stSalesOrderId + ', results.length=' + results.length);
						}
						
						if (i == iTotalOrderLineCount - 1 || (i < iTotalOrderLineCount - 1 && nextID != stSalesOrderId)) {
							if (arrOrderHasUpdate[stSalesOrderId] == true && recSalesOrder) {
								var t0 = new Date().getTime();
								var sUpdateSOID = nlapiSubmitRecord(recSalesOrder);
								var t1 = new Date().getTime();
								var tSubmit = t1 - t0;
								nlapiLogExecution('AUDIT', stLoggerTitle, '[i=' + i + '] Updated Sales Order Successfully, sUpdateSOID= ' + sUpdateSOID + ', stSOID=' + stSOID + ', tSubmit=' + tSubmit + ' milliseconds');
							}
						}
					}
					else {
						nlapiLogExecution('AUDIT', stLoggerTitle, '[' + i + '] Order has Holds or Financing not Authorized!! stStartingInternalId=' + stStartingInternalId + ', stSOID=' + stSOID);
					}
				} 
				catch (error) {
					var stError = (error.getDetails != undefined) ? error.getCode() + ': ' + error.getDetails() : error.toString();
					nlapiLogExecution('ERROR', stLoggerTitle, '[' + i + '] Error Occured, Reason = ' + stError);
				}
			}  // End of Loop
			var tEnd = new Date().getTime();
			var tTotal = tEnd - tStart; 
			nlapiLogExecution('DEBUG', 'End of Loop', 'i=' + i + ', Total Execution Time tTotal=' + tTotal + ' milliseconds');
		}
    }
    
    return bReSchedule;  
}


function searchGeneralHolds(stSalesOrderId,arrExemptHolds)
{
    var bHasNoGeneralHolds = true;
    
    var filters = [];
        filters.push(new nlobjSearchFilter('custrecord_nls_gh_hold_transaction',null,'anyof',stSalesOrderId)); 
        filters.push(new nlobjSearchFilter('isinactive',null,'is','F'));
        filters.push(new nlobjSearchFilter('custrecord_nls_gh_hold_status',null,'anyof',HOLDSTATUS_ONHOLD));
        
    if(arrExemptHolds.length > 0)
        filters.push(new nlobjSearchFilter('custrecord_nls_gh_hold_reason',null,'noneof',arrExemptHolds));
        
    var columns = [];
        columns.push(new nlobjSearchColumn('internalid').setSort());        
    
    var results = nlapiSearchRecord('customrecord_nls_general_hold', null, filters, columns);
    if(results)
    {
        bHasNoGeneralHolds = false;        
    }
    
    return bHasNoGeneralHolds;
}

function getSavedSearchResult(stRecordType,stSavedSearch,arrFilters,arrColumns)
{
	// *** DF-10604 ***
	var stLoggerTitle = 'getSavedSearchResult';	
	var results = [];
	
	try {		
		var results = nlapiSearchRecord(stRecordType, stSavedSearch, arrFilters, arrColumns);
	    if (results) {
			nlapiLogExecution('AUDIT', stLoggerTitle, 'Saved Search: ' + stSavedSearch + ', Found results.length=' + results.length + ' orders');
		}
		else {
			nlapiLogExecution('AUDIT', stLoggerTitle, 'search Result is BLANK');
		}	
	} catch (error) {
		var stError = (error.getDetails != undefined) ? error.getCode() + ': ' + error.getDetails() : error.toString();
        nlapiLogExecution('ERROR', stLoggerTitle, stError);		 
	}
    return results;
}