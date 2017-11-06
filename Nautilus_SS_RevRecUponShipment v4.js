/*
DF-8762 - GAP 94 is timing out, throwing an SSS_TIME_LIMIT_EXCEEDED
Modified By: KCHANG 
Last Modified: 3/23/2015
Change the reschedule usage level from 300 to 4000, this will force the script to exit and rescheduled itself sooner.
*/
/**
 * Module Description
 * Version    Date            Author           Remarks
 * 1.00       31 Oct 2013     iantiqueno	   Nautilus Gap 094: Revenue Recognition Upon Shipment
 */

var PENDING_BILLING = 'pendingBilling';
var PENDING_BILLING_PARTIALLY_FULFILLED = 'pendingBillingPartFulfilled';

function schedRevRecUponShipment(type){
    var stLoggerTitle = "schedRevRecUponShipment";
    nlapiLogExecution('AUDIT', stLoggerTitle, new Date() + ' ===============BEGIN===============' + new Date());
    var context = null;
    var stSaveSearchParam = "";
    var arSO = {};
	var sErrorMsg = '';
    context = nlapiGetContext();
    var stExecType = context.getExecutionContext();
	
    if (stExecType == 'scheduled') {
        stSaveSearchParam = context.getSetting('SCRIPT', 'custscript_savesearch_param_v3');
        nlapiLogExecution('AUDIT', stLoggerTitle, 'Saved Search: ' + stSaveSearchParam);
    }

    if (stSaveSearchParam != null) {
        var arSOWithValidQntyInternalId = new Array();        
        arSO = doLoadSaveSearch(stSaveSearchParam);
        for (var intIndex in arSO) {
//        	checkGovernance(300);
			checkGovernance(6000);
            var stSalesOrderNum = '';
			var rcdLineItem;
            try {
	            nlapiLogExecution('AUDIT', stLoggerTitle, 'Processing Search result Index: '+ intIndex);
	            rcdLineItem = arSO[intIndex];
	            var stDeferredBilling = rcdLineItem.getValue('custbody_deferred_billing', null, null);
	            var intSalesOrderId = rcdLineItem.getValue('internalid', null, null);
	            stSalesOrderNum = rcdLineItem.getValue('tranid', null, null);
	            var stShipComplete = rcdLineItem.getValue('shipcomplete', null, null);
	            var intTerms = rcdLineItem.getValue('terms', null, null);
	            var intPaymentMethodId = rcdLineItem.getValue('paymentmethod', null, null);
	            var stOrderStatus = rcdLineItem.getValue('statusref', null, null);			
			
                if (stDeferredBilling == 'F') {
                    if (stOrderStatus == PENDING_BILLING || stOrderStatus == PENDING_BILLING_PARTIALLY_FULFILLED) {
                        nlapiLogExecution('AUDIT', stLoggerTitle, 'Entered condition where Deferred Billing is False');
                        nlapiLogExecution('AUDIT', stLoggerTitle, "Created From Sales Order Internal ID: " + intSalesOrderId + ' with Sales Order No# : [ ' + stSalesOrderNum + ' ]');

                        // Not complete order if SO status is Pending Billing/ Partially fulfilled && Ship Complete =T//
                        // Added 10/04/2014 Ayman Elkhashab
                        var createBill = true;
                        if (stOrderStatus == PENDING_BILLING_PARTIALLY_FULFILLED && stShipComplete == 'T') {
                            createBill = false;
                        }
                        //
                        if (createBill) {
							if (isEmpty(intPaymentMethodId) == false) {
								TransformSubmitRecord(rcdLineItem, 'cashsale', intSalesOrderId);                                
                            } else {
								TransformSubmitRecord(rcdLineItem, 'invoice', intSalesOrderId);                                
                            }
                        }
                    }
                } else if (stDeferredBilling == 'T') {
                    nlapiLogExecution('AUDIT', stLoggerTitle, 'Entered condition where Deferred Billing is True');
                    nlapiLogExecution('AUDIT', stLoggerTitle, 'Ship Complete before in condition for Pending Billing Partially Fulfilled: ' + stShipComplete);

                    if (stOrderStatus == PENDING_BILLING_PARTIALLY_FULFILLED) {
                        nlapiLogExecution('AUDIT', stLoggerTitle, 'Entered condition where Status is Pending Billing Partially Fulfilled');
                        nlapiLogExecution('AUDIT', stLoggerTitle, 'Ship Complete before Ship Complete condition: ' + stShipComplete);

                        if (stShipComplete == 'F') {
                            nlapiLogExecution('AUDIT', stLoggerTitle, 'Ship Complete in Ship Complete condition: ' + stShipComplete);                            
                            nlapiLogExecution('AUDIT', stLoggerTitle, "Created From Sales Order Internal ID: " + intSalesOrderId + ' with Sales Order No# : [ ' + stSalesOrderNum + ' ]');

							if (SearchItemFulfillment(intSalesOrderId)){
                                nlapiLogExecution('AUDIT', stLoggerTitle, 'Executed Saved Search and is NOT null');
                                
								if (isEmpty(intPaymentMethodId) == false) {
									TransformSubmitRecord(rcdLineItem, 'cashsale', intSalesOrderId);                                
	                            } else {
									TransformSubmitRecord(rcdLineItem, 'invoice', intSalesOrderId);                                
	                            }
                            }
                        }
                    } else if (stOrderStatus == PENDING_BILLING) {
                        nlapiLogExecution('AUDIT', stLoggerTitle, 'Entered condition where Status is Pending Billing');
                        nlapiLogExecution('AUDIT', stLoggerTitle, "Created From Sales Order ID: " + intSalesOrderId + ' from Sales Order No# : [ ' + stSalesOrderNum + ' ]');
                        
                        if (SearchItemFulfillment(intSalesOrderId)) {
                            nlapiLogExecution('AUDIT', stLoggerTitle, 'Executed Saved Search and is NOT null');                            
                            
	                        if (isEmpty(intPaymentMethodId) == false) {
								TransformSubmitRecord(rcdLineItem, 'cashsale', intSalesOrderId);                                
                            } else {
								TransformSubmitRecord(rcdLineItem, 'invoice', intSalesOrderId);                                
                            }
                        }
                    }
                }
            } catch (e) {
				//*** DF-8515 - Modify Rev Rec Error to include additional information ***
				var sErrorType = 'Unexpected Error';
				sErrorMsg = e.toString();
                if (e.getCode() && e.getCode() == "CC_PROCESSOR_ERROR") {
					sErrorType = e.getCode();
					sErrorMsg = e.getDetails();                    
                }
				nlapiLogExecution('Error', stLoggerTitle, 'Found Error on Sales Order No# : [ ' + stSalesOrderNum + ' ] : ' + sErrorMsg);
				sErrorMsg = 'Exception caught in Try/Catch block - ' + sErrorMsg;				
				WriteErrorToCustomRecord(rcdLineItem, sErrorMsg, sErrorType);
                continue;
            }
        }
    } else {
        nlapiLogExecution('ERROR', stLoggerTitle, "Save Search Param is :" + stSaveSearchParam + "[" + stLoggerTitle + "]");
    }
    nlapiLogExecution('AUDIT', stLoggerTitle, new Date() + ' ===============END=============== ' + new Date());
}

function SearchItemFulfillment(intSalesOrderId){
	var ar_IF_Parameter = new Array();
    var ar_IF_Columns = new Array();

    ar_IF_Columns[0] = new nlobjSearchColumn('type');
    ar_IF_Columns[1] = new nlobjSearchColumn('tranid');
    ar_IF_Columns[2] = new nlobjSearchColumn('entity');
    ar_IF_Columns[3] = new nlobjSearchColumn('type');
    ar_IF_Columns[4] = new nlobjSearchColumn('custbody_pod_received');
    ar_IF_Columns[5] = new nlobjSearchColumn('internalid');

    //ar_IF_Parameter[0] = new nlobjSearchFilter("type", null, "anyof", ["ItemShip"]);
    ar_IF_Parameter[0] = new nlobjSearchFilter("createdfrom", null, "anyof", intSalesOrderId);
    
    var obj_IF_SaveSearch = nlapiSearchRecord('itemfulfillment', 'customsearch_nautilus_if_savesearch_2', ar_IF_Parameter);
	if (obj_IF_SaveSearch && obj_IF_SaveSearch.length > 0){
		return true;
	}else{
		return false;}
}

function TransformSubmitRecord(rcdLineItem, sToType, intSalesOrderId)
{		
	//*** DF-8515 - Modify Rev Rec Error to include additional information ***
	var sError = '';
	var sErrorType = 'Process Error';
	var stLoggerTitle = 'TransformSubmitRecord';
	var sSubType = '';
	try {
		sSubType = 'Transform Record'; 
		var BillRec = nlapiTransformRecord('salesorder', intSalesOrderId, sToType);
		if (BillRec) {
			sSubType = 'Submit Record';
			var intBillRec = nlapiSubmitRecord(BillRec);
			if (intBillRec) {
				nlapiLogExecution('AUDIT', 'TransformSubmitRecord', sToType + ' RECORD HAVE BEEN CREATED ID: ' + intBillRec + ' from Sales Order No# : ' + intSalesOrderId);
			}
			else{						
				sError = 'Error occured in Netsuite when Submitting ' + sToType;
			}
		}
		else{
			sError = 'Error occured in Netsuite when Transforming Sales Order to ' + sToType;		
		}
		if (sError != ''){
			sErrorType = 'NS API Error';
			WriteErrorToCustomRecord(rcdLineItem, sError, sErrorType);
		}	
	} catch (e) {		
		sError = e.toString();
		if (e.getCode() && e.getCode() == "CC_PROCESSOR_ERROR") {
			sErrorType = e.getCode();
			sError = e.getDetails();                    
        }
		
		sError = 'Exception caught in Try/Catch block [' + stLoggerTitle + '], Error Details:' + sError;
		nlapiLogExecution('Error', stLoggerTitle, 'Found Error on Sales Order Internal ID : ' + intSalesOrderId + ', ' + sError);				
		WriteErrorToCustomRecord(rcdLineItem, sError, sErrorType + ' - ' + sSubType);
	}
}

function WriteErrorToCustomRecord(rcdLineItem, sErrorMsg, sErrorType)
{
	var stLoggerTitle = 'WriteErrorToCustomRecord';	
	try {
		//*** DF-8515 - Modify Rev Rec Error to include additional information ***
		var recRevRecError = nlapiCreateRecord('customrecord_gap94_rev_rec_errors');
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_internalid', rcdLineItem.getValue('internalid'));
	    recRevRecError.setFieldValue('custrecord_nls_rev_rec_order_date', rcdLineItem.getValue('datecreated'));       
	    recRevRecError.setFieldValue('custrecord_nls_rev_rec_so_id', rcdLineItem.getValue('internalid'));
		// ('name'));entityid
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_customer', rcdLineItem.getValue('name'));
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_subsidiary', rcdLineItem.getText('subsidiary'));
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_shipcomplete', rcdLineItem.getValue('shipcomplete'));
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_status', rcdLineItem.getText('statusref'));
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_amount', rcdLineItem.getValue('totalamount'));
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_channel', rcdLineItem.getText('custbody_nls_channel'));
		//custbody_nls_financing_company
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_financing_company', rcdLineItem.getText('custbody_nls_financing_company'));
		//Payment Method = custbody_nls_payment_method
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_pay_method', rcdLineItem.getText('custbody_nls_payment_method'));
		//Payment Type = paymentmethod
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_payment_type', rcdLineItem.getText('paymentmethod'));
	    // Error Detail: custrecord_nls_rev_rec_error_msg
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_error_msg', sErrorMsg);
		// Error Type: custrecord_nls_rev_rec_error_type
		recRevRecError.setFieldValue('custrecord_nls_rev_rec_error_type', sErrorType);
		
	    var iLog = nlapiSubmitRecord(recRevRecError, false, true);
		if (iLog) {
			nlapiLogExecution('debug', 'WriteErrorToCustomRecord', 'Write error to custom record successfully');
		}	
	} catch (e) {
		var sError = 'Exception caught in Try/Catch block [' + stLoggerTitle + '], Error Details:' + e.toString();
		nlapiLogExecution('Error', stLoggerTitle, sError);
	}
}
function doLoadSaveSearch(stSaveSearchInternalId){
	var stLoggerTitle = 'doLoadSaveSearch';
	var results = [];
	try {	    
	    var objSaveSearch = nlapiLoadSearch('transaction', stSaveSearchInternalId);
	    var resultset = objSaveSearch.runSearch();
	    var intSearchId = 0;
	    if (objSaveSearch != null) {
		//*** DF-8515 Prevent duplicate UNEXPECTED ERROR - get the first 1000 records
	//        do {
	            var arResultSlice = resultset.getResults(intSearchId, intSearchId + 1000);
	//            for (var rs in arResultSlice) {
	//                results.push(arResultSlice[rs]);
	//                intSearchId++;
	//            }
	//        } while (arResultSlice.length >= 1000);
			results = arResultSlice;
	    }
	} catch (e) {
		var sError = 'Exception caught in Try/Catch block [' + stLoggerTitle + '], Error Details:' + e.toString();
		nlapiLogExecution('Error', stLoggerTitle, sError);
	}
    return results;
}

function isEmpty(stValue){
    if ((stValue == '') || (stValue == null) || (stValue == undefined)) {
        return true;
    }

    return false;
}

function checkGovernance(myGovernanceThreshold)
{
	var context = nlapiGetContext();
	if( context.getRemainingUsage() < myGovernanceThreshold )
	{
		var state = nlapiYieldScript();
		if( state.status == 'FAILURE')
		{
			nlapiLogExecution("ERROR","Failed to yield script, exiting: Reason = "+state.reason + " / Size = "+ state.size);
			throw "Failed to yield script";
		}
		else if ( state.status == 'RESUME' )
		{
			nlapiLogExecution("AUDIT", "Resuming script because of " + state.reason+".  Size = "+ state.size);
		}
	// state.status will never be SUCCESS because a success would imply a yield has occurred.  The equivalent response would be yield
	}
}