/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * This client script applies to Sales order ONLY
 * Last Modified: 5/26/2017
 * DF-11752 - Shipping Cost is 0.00 after line Ship To is changed
 * DF-11731 - Shipping & Tax is not recalculated when changing the payment method/type FROM Progressive Leasing
 * DF-11734 - Calculated Tax on Progressive Leasing orders when the Ship to = Hawaii does not reflect order level discounts
 * DF-11753 - Remove Pop Up messages for Progressive Leasing
 * DF-11754 - PL Submit Invoice Information call should not occur at Save & Review
 * DF-11755 - Lease ID validation to check if the Lease ID has been used on another sales order is not present at Save & Review
 * DF-11756 - Order ID is not present message if order with PL payment method has not been saved previously
 * DF-11757 - "Calculate Total" check box should be systematically checked when PL payment method and also recalculate tax
 * Last Modified: 5/31/2017
 * DF-11752 Shipping Cost is 0.00 after line Ship To is changed
 * DF-11753 Remove Pop Up messages for Progressive Leasing
 * DF-11754 PL Submit Invoice Information call should not occur at Save & Review
 * DF-11755 Lease ID validation to check if the Lease ID has been used on another sales order is not present at Save & Review
 * DF-11756 Order ID is not present message if order with PL payment method has not been saved previously
 * DF-11759 Ability by role to trigger "Submit Invoice" call if sales order has been modified and new PL contract needed
 * DF-11761 Ability for user to manually enter PL ID
 * Last Modified: 6/5/2017
 * Author: KCHANG * 
 * DF-11872 Line "J" code not added on Edit and shipping does not zero out when header promotion is on a PL order
 * DF-11900 Do not allow more than one Progressive Leasing order to be submitted with the same PL Lease ID.
 * DF-11888 Do not allow PL order to submit if Service item(s) on order
 * DF-11907 Do not allow Direct orders to be submitted with different addresses on item lines
 * Last Modified: 6/23/2017
 * DF-11908 Prevent SAVE if PL order total exceeds 110% of the Progressive Leasing credit limit
 * Last Modified: 6/27/2017
 * DF-11908, DF-11922, DF-11872, DF-11871, DF-11860, DF-11734
 * DF-11934 Store error message on SO if eSign URL is not returned at Save and Submit
 * Last Modified: 7/06/2017
 * DF-11752 Shipping Cost is 0.00 after line Ship To is changed
 * Last Modified: 7/10/2017
 * DF-11971 eSign URL validation
 * Last Modified: 7/13/2017 7/14/2017
 * DF-11973 Unable to update the "Hold Status" on a hold record
 * DF-11974: Location is not set on Retail Orders when the Retail Region Logic = False
 * Last Modified: 7/17/2017
 * DF-9521 Direct Orders should settle complete based on payment method or finance partner
 * Create NLS_Library_SS2.0 folders ./lib
 * DF-12567: Price Level, Location & Amount are editable by roles that are not permitted to do so
 * DF-10628: Items on orders are Defaulting to Next Price Level if Correct Level is Not Defined
 * DF-12571: Direct channel User is not allowed to modify Ship Complete field on sales order form
 * Last Modified: 10/30/2017
 */
define(['N/https', 'N/log', 'N/search', 'N/record', 'N/format', 'N/runtime', 'N/ui/dialog', 'N/error', '../NLS_Library_SS2.0/NLS_Lib_SO', '../NLS_Library_SS2.0/NLS_Lib_Router_Services', '../NLS_Library_SS2.0/NLS_Lib_ProgressiveLeasing'],
/**
 * @param {record} record
 * @param {search} search
 */
function(https, log, search, record, format, runtime, dialog, error, lib, nls_ws, lib_pl) {
	var CONSTANT_SHIPPING_CARRIER_MORE = '1';
	var CONSTANT_CHANNEL_DIRECT = '1';
	var CONSTANT_CHANNEL_RETAIL = '2';
	var CONSTANT_SUBSIDIARY_US = '1';
	var CONSTANT_SUBSIDIARY_CA = '2';
	// Tax Codes
	var CONSTANT_NotTaxable_US = '-8';
	var CONSTANT_NotTaxable_CAN = '14877';
	var CONSTANT_TAXCODE_AVATAX_US = '27764';
	var CONSTANT_TAXCODE_AVATAX_CAN = '27767';
	var CONSTANT_TAXCODE_CCH_US = '8880';
	var CONSTANT_TAXCODE_CCH_CAN = '8883';
	
	// Banded Shipping Items (Standard)	
	var CONSTANT_SHIPPING_METHOD_BANDED_SHIPPING = '227';
	var CONSTANT_SHIPPING_METHOD_BANDED_SHIPPING_CA = '17169';
	// Expedited Shipping Items (US ONLY) 
	var CONSTANT_BANDED_SHIPPING_NEXTDAY = '31607';
	var CONSTANT_BANDED_SHIPPING_2DA = '31608';
	
	// Item Shipping Types * 1 - Banded	 * 2 - Flat Rate	 * 3 - White Glove
	var SHIP_TYPE_BANDED = '1';
	var SHIP_TYPE_FLAT = '2';
	var SHIP_TYPE_WHITE_GLOVE = '3';

	//***** Expedited Shipping ***** Nautilus Mode of Transport
	var MOT_Expedited_2DA = '4';
	var MOT_Expedited_Overnight = '3';
	var MOT_Standard_Origin = '6';
	var MOT_Standard = '1';
	// Script 103 Direct Shipping
	var arNotSupprtedItemTypes = ['Discount', 'Subtotal', 'Service', 'OthCharge', 'Payment', 'Markup'];
	var arrBandedShipVia = [CONSTANT_SHIPPING_METHOD_BANDED_SHIPPING, CONSTANT_SHIPPING_METHOD_BANDED_SHIPPING_CA, CONSTANT_BANDED_SHIPPING_NEXTDAY, CONSTANT_BANDED_SHIPPING_2DA];
	var arrSupportedShipType = [SHIP_TYPE_BANDED, SHIP_TYPE_FLAT, SHIP_TYPE_WHITE_GLOVE];
	var arrNonExpediteState = ['HI', 'AK', 'PR'];
	var arrExpediteShipItems = [MOT_Expedited_2DA, MOT_Expedited_Overnight];
	// stDepartment != '80' && stDepartment != '86'
	var arrWarrantyDepartments = ['80', '86'];
	var FORM_INTERCOMPANY = '162';
	// Customer Ship to Address
	var addrDetails;
	var mShipAddr;
	// Global Level Nautilus Region
	var iDirUSRegion;
	var iRegionID;
	// Price Level Gap 217
	var	arrDisabledColumns;
	var arrEnabledColumns;
	// Line Number, Retail Dates: Request Date, Expected Ship Date, Cancel Date 
	var iInitMaxNum;
	var iInitLineCount;
	// 175	eBizNET WMS Sales Order - Retail
	// 174	eBizNET WMS Sales Order - SPS Retail
	var CONSTANT_SO_RETAIL_FORM = '175';
	var CONSTANT_SO_SPS_FORM = '174';
	//*** Retail Store
	var STATUS_PENDINGFULFILL = 'Pending Fulfillment';   //'B';	
	var STATUS_PENDINGAPPROVAL = 'Pending Approval'  // 'A';
	// DC waved: US DC Portland: Channel - Retail (ID=21)
	var LOCATION_RETAIL_STORE = '21';
	//4. Ship Via: WILL CALL (ID=17170)
	var SHIPVIA_RETAIL_STORE = '17170';	
	var PRICE_LEVEL_RETAIL_STORE = '88';
	var ORIGIN_RETAIL_STORE = '19';
	// 231 eBizNET WMS Sales Order - Retail Store
	var RETAIL_Store_FORM = '231';
	//*** Item Count Down	
	var g_arrDeleteItems = new Array();
	var SUB_CHANNEL_CALL_CENTER = '2';
	
	// Progressive Leasing
	var arNotLeasingItemTypes = ['Service'];
	// Payment Method List: Progressive Leasing = 103?
	var CONSTANT_PAY_TYPE_LEASING = '109';	// Sandbox 2
	// Accounting List: Payment Method : Progressive Leasing = 27?
	var CONSTANT_PAY_METHOD_LEASING = '27';  // Sandbox 2
	// 173 eBizNET WMS Sales Order – Direct Integra
	// 161 eBizNET WMS Sales Order - Direct
	// 170 eBizNET WMS Sales Order - Support
	// 190 eBizNet WMS Warranty Sales Order
	var arrLeasingForms = ['173','161', '170'];
	// DF-12571: Direct channel User is not allowed to modify Ship Complete field on sales order form
	var arrNoShipCompForms = ['173','161', '170', '190'];
	var arrNoBillToLeasingState = ['NJ', 'WI', 'MN', 'VT', 'IL'];
	var CONSTANT_NO_LEASING_STATE = 'IL';	
	// Entity/Use Code = J = '3'
	var CONSTANT_LEASING_EXEMPT_CODE = '3';  // G
	var mbChangePayment = false;
	// *** PRICE LEVEL ***
	var PRICE_LEVEL_EMPLOYEE = '51';
	var PRICE_LEVEL_CUSTOM = '-1';
	
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function NLS_PageInit(scriptContext) {    	  	
    	var currentRecord = scriptContext.currentRecord;
    	var currentForm = currentRecord.getValue('customform'); 
    	var ctxMode = scriptContext.mode;
    	//*** Retail Store
    	if (ctxMode === 'create' && currentForm === RETAIL_Store_FORM){
    		SetRetailStoreHeaderFields(currentRecord, ctxMode);
    	} else {
    		// Ship to Address
    		var isMultiShip = currentRecord.getValue('ismultishipto');
    		if (isMultiShip){
    			GetShipToAddress(currentRecord);
    		}
    	}
    	//*** Item Count Down/Up
    	RefreshDeletedArray();
    	
    	//*** Initialize Max Line Number
    	if (currentForm === CONSTANT_SO_RETAIL_FORM || currentForm === CONSTANT_SO_SPS_FORM) {
    		GetSavedLineNum(currentRecord);
    	}
    	
//    	DF-12567: Price Level, Location & Amount are editable by roles that are not permitted to do so
    	var iLineCount = currentRecord.getLineCount('item');
//    	if (iLineCount > 0){
//	    DisableLineFields(currentRecord, iLineCount);
//	    alert("DEBUGGER - Page Init DisableLineFields: Price Level, Locaiton, Amount");
//    	}
    	// DF-12571: Direct channel User is not allowed to modify Ship Complete field on sales order form
    	if (arrNoShipCompForms && lib.inArray(arrNoShipCompForms, currentForm)) {
    		//DisableShipCompleteSOform();
    		var objField = currentRecord.getField('shipcomplete');
    		objField.isDisabled = true;
//    		alert("DEBUGGER - Page Init DisableShipComplete currentForm: " + currentForm + ", objField.id=" + objField.id);
    	}
    }
    
    /**
     * Function to be executed when field is changed:
     * Promotion, Mode of Transport, 3 Coupon Codes (custom)
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @since 2015.2
     */
    function NLS_FieldChanged(scriptContext) {
    	var bOK = true;    	
    	var currentRecord = scriptContext.currentRecord;
    	var fieldName = scriptContext.fieldId;
    	var custForm = currentRecord.getValue('customform');
    	// Populate Promotion with Coupon Code
    	if (fieldName === 'custbody_nls_web_promocode' || fieldName === 'custbody_nls_mo_promocode' || fieldName === 'custbody_nls_cc_promocode'){
    		bOK = setPromoCode(currentRecord, fieldName);
    	} else if (fieldName === 'promocode'){
    		if (custForm !== RETAIL_Store_FORM) {
//    			alert('Promotion changed - calculating shipping cost ...'); 
    			// Calculate Promotion Leasing?  Header Ship To Entity Use Code    	
    	    	var obLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);	
    	    	if (obLeasing){    	    		
    	    		if (!obLeasing.shipAddr && mShipAddr){
    	    			obLeasing.shipAddr = mShipAddr;
    	    		} else if (!mShipAddr && obLeasing.shipAddr){
    	    			mShipAddr = obLeasing.shipAddr;
    	    		}
    	    		
//    	    		SetHeaderTaxUseCode(currentRecord, obLeasing);
    	    		RecalculatePromotion(currentRecord, obLeasing);
    	    	}    			    			
    		}
    		
    	} else if (fieldName === 'custbody_nls_mode_of_transport') {
    		var obLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);    		
			if (obLeasing.bOK) {
				if (obLeasing.sErrorMessage){
					alert("MOT Changed - Leasing Validation Failed!" + '\n' + obLeasing.sErrorMessage);					
				} else {
					if (obLeasing.bSaveCalculate){
						RecalculateItems(currentRecord);
					} 
				}				
			}			
    	} else if (fieldName === 'custbody_nls_payment_method' || fieldName === 'paymentmethod'){
//    		var obLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);
//			if (obLeasing.bHasPayments && obLeasing.bOK) {    		
	    		mbChangePayment = true;	    		
//    		} 
			currentRecord.setValue({
    			fieldId: 'custbody_nls_pl_calc_total',
    			value: false,
    			ignoreFieldChange: true,
    		    fireSlavingSync: false
    		});    		
    	} else if (fieldName === 'custbody_nls_pl_calc_total') {    
    		var bCheck = currentRecord.getValue('custbody_nls_pl_calc_total');
    		if (bCheck){
	    		var obLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);
	    		
//    			if (obLeasing.bHasPayments && obLeasing.bOK && obLeasing.bSaveCalculate){
				if (obLeasing){					
					if (!obLeasing.shipAddr && mShipAddr){
    	    			obLeasing.shipAddr = mShipAddr;
    	    		} else if (!mShipAddr && obLeasing.shipAddr){
    	    			mShipAddr = obLeasing.shipAddr;
    	    		}
//					alert("Calculating Line shipping costs and Tax Entity Use Codes mShipAddr=" + mShipAddr + ", obLeasing.shipAddr=" + obLeasing.shipAddr);
					// Checkbox: Calculate Total 
//					SetHeaderTaxUseCode(currentRecord, obLeasing);
					RecalculateItemsShipGroups(currentRecord, obLeasing);

//	    			if (obLeasing.sErrorMessage){    				
//	    				if (obLeasing.bOK && obLeasing.bSaveCalculate){
//	    					alert("Line Shipping and Tax Use Codes Updated");	
//	    				} else {
//	    					alert(obLeasing.sErrorMessage);
//	    				}	    			
//		    		} 
				}
    		}
    	} else if (fieldName === 'custbody_nls_pl_get_approved') {
    		var bCheck = currentRecord.getValue('custbody_nls_pl_get_approved');
    		if (bCheck){
	    		var obLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);
				if (obLeasing.bLeasing && obLeasing.bOK) {
//					alert("Calling NLS Financing web service....");
					var plID = GetApprovedAcctID_ProgLeasing(currentRecord, obLeasing);
				} else {
					var sError = "Payment methods not qualified for Progressive Leasing. "
					if (obLeasing.sErrorMessage){
						sError = obLeasing.sErrorMessage;
					}
					alert(sError);
				}
    		}    		
    	} 
    	else if (fieldName === 'custbody_nls_request_date' || fieldName === 'custbody_nswmspoexpshipdate' || fieldName === 'custbody_nls_canceldate') {
    		UpdateLineDatesWithHeaderDates(currentRecord, fieldName);    
    	} else if (fieldName === 'custbody_ava_shiptousecode') {
//    		var obLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);
//			if (obLeasing && obLeasing.bSaveCalculate && obLeasing.bOK) {
//				UpdateLineEntityUseCode(currentRecord, fieldName);
//			}
    	} else if (fieldName === 'custbody_nls_pl_submit_leasing') {
    		var bChecked = currentRecord.getValue('custbody_nls_pl_submit_leasing');
    		if (bChecked){
    			var sError = "Order cannot be submitted to Progressive Leasing! \n";
    			if (!currentRecord.id){
    				alert(sError + "Please save the order before submit to Progressive Leasing");
    			} else {
		    		var obLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);
		    		
		        	if (obLeasing && obLeasing.bOK && obLeasing.bHasPayments){
		        		if (obLeasing.sErrorMessage && !obLeasing.bSubmitOrder){	        			
							alert(sError + obLeasing.sErrorMessage);
						} else if (obLeasing && obLeasing.bSaveCalculate && obLeasing.bLeasing && obLeasing.bSubmitOrder) {
	//						alert("Order validated successfully.  Submitting order to Progressive Leasing...");						
							SubmitInvoiceInfoToPL(currentRecord, obLeasing);
						} 
		        	} else {
		        		var sError = "Progressive Leasing validation Failed";
		        		alert(sError + " - " + obLeasing.sErrorMessage);	        		
		        	}
    			}
    		}
    	}

    	return bOK;
    }
    /**
     * Function to be executed when field is slaved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     *
     * @since 2015.2
     */
    function NLS_PostSourcing(scriptContext) {
    	var currentRecord = scriptContext.currentRecord;    	
    	var subList = scriptContext.sublistId;
    	var fieldID = scriptContext.fieldId;
    	var currentForm = currentRecord.getValue('customform');
    	var bOK = true;
//		dialog.alert ({
//			title : "NLS_PostSourcing",					
//			message : "fieldID=" + fieldID + ', currentForm=' + currentForm + ', subList=' + subList
//		});
		if (currentForm === RETAIL_Store_FORM){
    		if (fieldID === 'item' && subList === 'item') {
    			SetRetailStoreFields(currentRecord, subList, fieldID);
    		}
    	} else {
    		if (fieldID === 'item' && subList === 'item') {
//    			EnableLineFields(currentRecord, subList, fieldID);
//    			var stItemType = currentRecord.getCurrentSublistValue({
//    	    		sublistId: 'item',
//    	    		fieldId: 'itemtype'
//    	    	});
    			//*** GAP 217 ***
    			// 1. Validate Item Price Level 
    			// 2. Set FOB Price Level 
//    			if (stItemType === 'InvtPart' || stItemType === 'Kit') {
//    				var custForms = runtime.getCurrentScript().getparameter('custscript_nls_shipcomp_forms'); 
//    				var arrCustForms = custForms;
//    				alert("DEBUGGER - NLS_PostSourcing AllowCustomForms=" + custForms + ", arrCustForms=" + arrCustForms);
//    				bOK = SetPriceLevel(currentRecord);
//    			}
    		}
    	}
		return bOK;
    }

    /**
     * Function to be executed after sublist is inserted, removed, or edited.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function sublistChanged(scriptContext) {
    	
    }

    /**
     * Function to be executed after line is selected.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function lineInit(scriptContext) {
//    	var currentRecord = scriptContext.currentRecord;    	
//    	var subList = scriptContext.sublistId;
//    	var fieldID = scriptContext.fieldId;
//    	var currentForm = currentRecord.getValue('customform');
//    	if (subList === 'item'){
//			EnableLineFields(currentRecord, subList, fieldID);
//		}
    }

    /**
     * Validation function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @returns {boolean} Return true if field is valid
     *
     * @since 2015.2
     */
    function NLS_validateField(scriptContext) {
    	var currentRecord = scriptContext.currentRecord;    	
    	var subList = scriptContext.sublistId;
    	var fieldID = scriptContext.fieldId;
    	var bOK = true;
    	var currentForm = currentRecord.getValue('customform');
    	var sSubsidiary = currentRecord.getValue('subsidiary');
    	var iChannel = currentRecord.getValue('custbody_nls_channel');

		//*** GAP 217 Set FOB Price Level
		// 1. Validate Item Price Level 
    	if (subList === 'item' && fieldID === 'item'){
    		var stDepartment = currentRecord.getValue('department');
        	if (!lib.inArray(arrWarrantyDepartments, stDepartment)) {
	    		alert("DEBUGGER - validateField subList=" + subList + ", fieldID=" + fieldID + ", currentForm=" + currentForm + ", sSubsidiary=" + sSubsidiary + ", iChannel=" + iChannel + ", stDepartment=" + stDepartment);
	    	
	//    		var stItemType = currentRecord.getCurrentSublistValue({
	//        		sublistId: 'item',
	//        		fieldId: 'itemtype'
	//        	});
	    		var stItemID = currentRecord.getCurrentSublistValue({
	        		sublistId: 'item',
	        		fieldId: 'item'
	        	});
	    		if (stItemID && currentForm !== FORM_INTERCOMPANY) {
		    		alert("DEBUGGER - validateField stItemID=" + stItemID);
//					bOK = ValidatePriceLevel(currentRecord);
	    		}
        	}
		}
    	return bOK;
    }
    
    /**
     * Validation function to be executed when sublist line is committed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function NLS_ValidateLine(scriptContext) {
    	var bOK = true;
    	var currentRecord = scriptContext.currentRecord;
    	var sublistName = scriptContext.sublistId;    	
    	var sSubsidiary = currentRecord.getValue('subsidiary');
    	var iChannel = currentRecord.getValue('custbody_nls_channel');
    	var isMultiShip = currentRecord.getValue('ismultishipto');
		var currentForm = currentRecord.getValue('customform');
		var iCust = currentRecord.getValue('entity');
		// Item Type
		var stItemType = currentRecord.getCurrentSublistValue({
    		sublistId: 'item',
    		fieldId: 'itemtype'
    	});
		// Item ID
		var idItem = currentRecord.getCurrentSublistValue({
            sublistId: sublistName,
            fieldId: 'item'
        });	
		alert("DEBUGGER - NLS_ValidateLine sublistName=" + sublistName + ", iChannel=" + iChannel + ", currentForm=" + currentForm + ", iCust=" + iCust
				+ ", stItemType=" + stItemType + ", idItem=" + idItem);
    	// SHIP TO ADDRESS
    	var shipAddr;
    	var isLeasing = false;
    	if (iCust && idItem){
	    	if (isMultiShip === true && stItemType) {
	    		// Line Ship To
	    		if (stItemType === 'InvtPart' || stItemType === 'Kit') {
	    			// DF-11752: Shipping Cost is 0.00 after line Ship To is changed
		    		shipAddr = currentRecord.getCurrentSublistValue({
		        		sublistId: 'item',
		        		fieldId: 'shipaddress'
		        	});	 
		    		
		        	// Global Level Default Customer Address
		        	if (shipAddr) {
		        		if (!mShipAddr || mShipAddr != shipAddr || !addrDetails){
		        			mShipAddr = shipAddr;
		        			addrDetails = lib.SearchCustomerAddrID(iCust, shipAddr);
	//	        			alert("DEBUGGER - Searching Direct Cust Address iCust=" + iCust + ", shipAddr=" + shipAddr + ", mShipAddr=" + mShipAddr);
	//	        			dialog.alert({
	//		    	    		title: "NLS_ValidateLine shipAddr ID=" + shipAddr + ", iCust=" + iCust,
	//		    	    		message: "DEBUGGER - SearchCustomerAddrID mShipAddr= " + mShipAddr + ', zip=' + addrDetails.zip + ', addrDetails.addrId = ' + addrDetails.addrId + ', iSTATE=' + addrDetails.iState
	//	    	    		});
		        		}
		    		}	        	
	    		}
	    	} else {
	    		shipAddr = currentRecord.getValue('shipaddresslist');
	//    		if (shipAddr && !addrDetails){
	    		if (shipAddr){
	    			if (!mShipAddr || mShipAddr != shipAddr){
		    			mShipAddr = shipAddr;
	//	    			alert("DEBUGGER - Searching Retail Cust Address iCust=" + iCust + ", shipAddr=" + shipAddr + ", mShipAddr=" + mShipAddr);
		    			addrDetails = lib.SearchRetailCustAddress(iCust, shipAddr);
		    			if (addrDetails){
	//	    				alert("DEBUGGER - Found Address addrDetails.count=" + addrDetails.count + ", addrDetails.addrId=" + addrDetails.addrId + ", addrDetails.zip=" + addrDetails.zip + ", shipzip=" + addrDetails.shipzip);
		    			}
	    			}
	    		}
	    	}
	    	if (addrDetails) {
	    		if (!mShipAddr && addrDetails.addrId){
					mShipAddr = addrDetails.addrId;
				}
	    		var obLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);
	    		
	    		if (obLeasing.bLeasing && obLeasing.bOK){
	    			isLeasing = true;
	    		}
	    	}
    	}
    	
    	if (bOK && sublistName === 'item' && stItemType && idItem){
    		var iDepartment = currentRecord.getValue('department');
    		//*** Set Item ASA for Commission with or without Ship To 
    		if (iChannel === CONSTANT_CHANNEL_DIRECT){	
    			// *** ASA ***
    			bOK = SetASA(currentRecord, stItemType);    		
    		}
    		// *** Change CCH Tax Code ***
        	bOK = FixAvaTaxCode(currentRecord);
        	
        	// Retail + Octane?
        	if (iChannel !== CONSTANT_CHANNEL_DIRECT && currentForm !== RETAIL_Store_FORM) {
        		if (stItemType === 'InvtPart' || stItemType === 'Kit') {
    		    	//*** SET Retail Dates
    	    		bOK = SetRetailItemDates(currentRecord);
    	    	}
        		//*** SET Line Numbers
        		if (!iInitMaxNum){
        			GetSavedLineNum(currentRecord);
        		}
        		bOK = SetSOItemLineNumber(currentRecord, iInitMaxNum);
        	}
        	
    		// Search customer Address ?
    		if (bOK && shipAddr && !lib.inArray(arNotSupprtedItemTypes, stItemType)){
    			// Retail Store? No Location / No Shipping / Manual Ship To 	    		
    			if (currentForm !== RETAIL_Store_FORM) {
    			
	    			if (addrDetails && addrDetails.zip) {
	    				var custShipToZip = addrDetails.zip;
	    				var sState = addrDetails.iState;										
		    		
			        	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
			    			return true;
			    		} else {
			    			//*** Set Location ***
							var sLocation = currentRecord.getCurrentSublistValue({
					    		sublistId: sublistName,
					    		fieldId: 'location'
					    	});
							// var locationOverride = nlapiGetLineItemValue('item', 'custcol_nls_location_override', k);
							var locOverride = currentRecord.getCurrentSublistValue({
								sublistId: 'item',
								fieldId: 'custcol_nls_location_override'
							});
//							dialog.alert({
//					    		title: 'NLS_ValidateLine Location Override=' + locOverride,
//					    		message: "sSubsidiary= " + sSubsidiary + ', idItem=' + idItem + ', iChannel= ' + iChannel + ', sLocation=' + sLocation + ', custShipToZip=' + custShipToZip
//					    	});	
					    	if (idItem && !sLocation && locOverride === false){
					    		bOK = SetLineLocation(currentRecord, sSubsidiary, iChannel, custShipToZip, idItem, sState);
					    	}
					    	
							//*** Set Shipping Rates ***
							// CheckShipTo HI_AK for Expedited Shipping						    	
					    	if (bOK === true && iChannel === CONSTANT_CHANNEL_DIRECT){
					    		bOK = ValidateExpediteShipping(currentRecord, addrDetails.state, sSubsidiary);
					    	
								if (bOK === true){
									var sPromo = currentRecord.getValue('promocode');
							    	bOK = SetCurrentLineItemShipping(currentRecord, sublistName, custShipToZip, idItem, sSubsidiary, sPromo, isLeasing);
								}
					    	}					    			
			    		}
	    			}
	    			else {
//	    				throw error.create({
//		                    name: 'SHIP_TO_ERROR',
//		                    message: "Invalid Line Ship To Zip Code"
//		                });
	    			}	    			
	    		} // Retail Store FORM?
    		} // shipAddr Ship TO Address
    		
    		//*** Set FOB Price Level
			//*** GAP 217 ***
    		if (currentForm !== FORM_INTERCOMPANY && currentForm !== RETAIL_Store_FORM) {
//    			alert("DEBUGGER - ValidateLine Gap 217 ValidatePriceLevel stItemType=" + stItemType);
        		if (stItemType === 'InvtPart' || stItemType === 'Kit' || stItemType === 'Service') {
        			// 1. Validate Item Price Level         			
    				bOK = ValidatePriceLevel(currentRecord);    	    		  				
        		}
        	}
    		if (bOK && iChannel !== CONSTANT_CHANNEL_DIRECT && currentForm !== FORM_INTERCOMPANY && currentForm !== RETAIL_Store_FORM) {
//    			alert("DEBUGGER - ValidateLine Gap 217 SetFOBPriceLevel stItemType=" + stItemType);
        		if (stItemType === 'InvtPart' || stItemType === 'Kit') {
        			// 2. Set FOB Price Level 
    				bOK = SetFOBPriceLevel(currentRecord);    				
        		}
        	}
    	} else {
    		if (isMultiShip === true && sublistName === 'shipgroup'){
        		bOK = SetShipGroupRate(currentRecord, sublistName, isLeasing);        		
        	} else {
        		//DF-11973 Unable to update the "Hold Status" on a hold record
//        		alert("DEBUGGER - sublistName=" + sublistName + ", stItemType=" + stItemType);
        		if (sublistName !== 'item' && sublistName !== 'shipgroup'){
        			bOK = true;
        		} else {
        			bOK = false;        		
        		}
        	}    		
    	}
    	
    	return bOK;
    }
    
    /**
     * Validation function to be executed when sublist line is inserted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateInsert(scriptContext) {
    	
    }

    /**
     * Validation function to be executed when record is deleted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function NLS_ValidateDelete(scriptContext) {
    	var currentRecord = scriptContext.currentRecord;
    	var sublistName = scriptContext.sublistId;
    	var isMultiShip = currentRecord.getValue('ismultishipto');
    	if (sublistName === 'item' && isMultiShip === true){
    		RemovedItemCountUp(currentRecord);
    	}
    	return true;
    }

    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function NLS_SaveRecord(scriptContext) {
    	var currentRecord = scriptContext.currentRecord;
    	var bOK = true;
    	var iChannel = currentRecord.getValue('custbody_nls_channel');			
        var isMultiShip = currentRecord.getValue({
        	fieldId: 'ismultishipto'
        });
    
    	var curForm = currentRecord.getValue('customform');
    	var sSubsidiary = currentRecord.getValue('subsidiary');
        //*** Reset Location for Ship complete
        if (bOK && isMultiShip === true){
        	var objLeasing = lib_pl.ValidateProgressiveLeasing(currentRecord, addrDetails);
        	if (objLeasing) {
//	        	var bDoNOTSubmit = currentRecord.getValue('custbody_nls_do_not_submit_order');
//	        	var discRate = currentRecord.getValue('discountrate');
	        	var itemCount = currentRecord.getLineCount('item');
	        	
//	        	var sAlert = "bOK=" + objLeasing.bOK  + ", bLeasing=" + objLeasing.bLeasing + ", bSaveCalculate=" + objLeasing.bSaveCalculate + ", bSubmitL=" + objLeasing.bSubmitOrder + ", bDoNOTSubmit=" + bDoNOTSubmit + ", discRate=" + discRate;
//        		alert(objLeasing.sErrorMessage + '\n' + sAlert);
	        	
        		if (objLeasing.sErrorMessage || !objLeasing.bSaveCalculate) {
        			// DF-11908 Prevent SAVE if PL order total exceeds 110% of the Progressive Leasing credit limit
        			if (objLeasing.sErrorCode === '888'){
        				bOK = false;
	        			dialog.alert ({
		    				title : "Progressive Leasing - Save=" + bOK,
		    				message : objLeasing.sErrorMessage + ", ErrorCode=" + objLeasing.sErrorCode
		    			});
	        			
        			} else {
        				bOK = objLeasing.bSaveCalculate;
        				alert("Save Order Error: " + objLeasing.sErrorMessage + ", ErrorCode=" + objLeasing.sErrorCode);
        			}
	        	}	        	
        	}
        	// Validate SO Item lines
        	if (bOK && objLeasing.bSaveCalculate){
        		bOK = ValidateSOItemLines(currentRecord, itemCount, objLeasing.bLeasing);
        	}
        	 // Save Record: ReCalculate Total ?
        	if (bOK && objLeasing.bSaveCalculate && objLeasing.bHasPayments) {
	        	var bCalculateTotal = currentRecord.getValue('custbody_nls_pl_calc_total');
	        	// Progressive Leasing Form ONLY 
//	        	if (!bCalculateTotal && mbChangePayment && lib.inArray(arrLeasingForms, curForm)){
	        	if (lib.inArray(arrLeasingForms, curForm) && (!bCalculateTotal || mbChangePayment)){
	        		if (!objLeasing.shipAddr && mShipAddr){
	        			objLeasing.shipAddr = mShipAddr;
	        		} else if (objLeasing.shipAddr && !mShipAddr){
	        			mShipAddr = objLeasing.shipAddr;
	        		}
	        		
	        		// Save & Review Button 
//	        		SetHeaderTaxUseCode(currentRecord, objLeasing);
//	        		alert('DEBUGGER - Save Order - Recalculating Line shipping costs and Tax Use Codes... bCalculateTotal=' + bCalculateTotal);
	        		RecalculateItemsShipGroups(currentRecord, objLeasing);
	        	}
        	}
        	if (bOK && objLeasing){
            	bOK = objLeasing.bSaveCalculate;
            }
        	// Ship Complete
        	if (bOK){
        		bOK = SetOrderSettleComplete(currentRecord);
        	}
        	
            var shipComplete = currentRecord.getValue('shipcomplete');
        	if (bOK && shipComplete === true){
				// Ship Complet to Recalculate Location with Common DC
				if (sSubsidiary === CONSTANT_SUBSIDIARY_US && iChannel === CONSTANT_CHANNEL_DIRECT && itemCount > 1) {
//	        		alert("DEBUGGER - SaveRecord.ResetShipCompleteDCLoc - sSubsidiary=" + sSubsidiary + ", iChannel=" + iChannel + ", itemCount=" + itemCount);
					bOK = ResetShipCompleteDCLoc(currentRecord, itemCount, sSubsidiary, iChannel);
				}
        	}
        }
        
        //*** Item Count Down        
        if (bOK){
//        	alert('IncrementItemCounter');
        	bOK = IncrementItemCounter(currentRecord);
        }
        //*** Retail Store
        if (bOK && curForm === RETAIL_Store_FORM) {
//        	alert('ApproveRetailStoreSO');
	        bOK = ApproveRetailStoreSO(currentRecord);	        
        }
//        var finalTotal = currentRecord.getValue('total');
//        var finalShipping = currentRecord.getValue('shippingcost');
//        alert('DEBUGGER - Final step Save Record: bOK=' + bOK + ", finalTotal=" + finalTotal + ", finalShipping=" + finalShipping);
        
    	return bOK;
    }
    
    function RefreshDeletedArray(){
		// Page Init - Item Count Down
		g_arrDeleteItems.length = 0;
	}
    /**
     * Client: Validate Line Function
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
//			for (var i = 0; i < itemCount; i++) {
			// Only commit item line when Taxable code is defaulted wrong with subsidiary
			var bCommitLine = false;
			// Default Tax Code to US Non-Taxable				
			var sTaxCode = CONSTANT_NotTaxable_US;
			if (subsidiary === CONSTANT_SUBSIDIARY_CA){
				sTaxCode = CONSTANT_NotTaxable_CAN;
			}			
			
			var itemTaxCode = curRecord.getCurrentSublistValue({
				sublistId: 'item', 
				fieldId: 'taxcode'		
			});
			var spTaxCode = curRecord.getCurrentSublistValue({
				sublistId: 'shipgroup', 
				fieldId: 'shippingtaxcode'
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
//					alert("Line Tax Codes Line=" + i + ", itemTaxCode = " + itemTaxCode + ", spTaxCode= " + spTaxCode + ", bCommitLine=" + bCommitLine);
				
//					curRecord.selectLine({
//						sublistId: 'item',
//						line: i
//					});
				curRecord.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: 'taxcode',
					value: sTaxCode,					
		            ignoreFieldChange: false,
		            fireSlavingSync: true
				});
//					curRecord.commitLine({
//						sublistId: 'item'
//					});
			}
//			}
		}
		return true;
    }      
    function GetShipToAddress(currentRecord){
    	var bOK = true;
    	if (!addrDetails){
    		var itemCount = currentRecord.getLineCount('item');
    		var iCust = currentRecord.getValue({
        		fieldId: 'entity'
        	});
    		
    		for (var iLine = 0; iLine < itemCount; iLine++) {    			
	    		// Item Type
	    		var stItemType = currentRecord.getSublistValue({
	        		sublistId: 'item',
	        		fieldId: 'itemtype',
	        		line: iLine
	        	});
		    	if (stItemType){
		        	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
		        		// SKIP
		        	} else {
		        		shipAddr = currentRecord.getSublistValue({
			        		sublistId: 'item',
			        		fieldId: 'shipaddress',
			        		line: iLine
			        	});
			    		// Ship To?
		        		if (shipAddr){		    				
		    				if (!mShipAddr){
		    					mShipAddr = shipAddr;
		    				}
		    				
		    				// Get Address Detail?	    				
	    					addrDetails = lib.SearchCustomerAddrID(iCust, shipAddr);
	    					if (!mShipAddr && addrDetails && addrDetails.addrId){
		    					mShipAddr = addrDetails.addrId;
		    				}
//	    					alert("DEBUGGER - Page Init" + ", mShipAddr=" + mShipAddr + ", shipAddr=" + shipAddr);
	    				}
		    		}
	        	}        		
    		}	    	
    	}
    	return true;
    }
    
    function ValidateSOItemLines(currentRecord, itemCount, bLeasing){
    	var bOK = true;
    	var addrDetails;
    	var shipAddr;
    	var preShipAddr;
    	var iChannel = currentRecord.getValue('custbody_nls_channel');
    	var iCust = currentRecord.getValue({
    		fieldId: 'entity'
    	});
    	for (var iLine = 0; iLine < itemCount; iLine++){
    		if (bOK){
	    		// Item Type
	    		var stItemType = currentRecord.getSublistValue({
	        		sublistId: 'item',
	        		fieldId: 'itemtype',
	        		line: iLine
	        	});	    		
	        	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
	        		// Progressive Leasing -     	
					//"3. Checking Qualified Order Items..." + '\n'
	        		// DF-11888 Do not allow PL order to submit if Service items(s) on order
	        		if (bLeasing && lib.inArray(arNotLeasingItemTypes, stItemType)){        			
		        		dialog.alert ({
		    				title : "Progressive Leasing ERROR - Invalid Item Type " + stItemType,
		    				message : "Please remove the service item from the order for Progressive Leasing"
		    			});
		        		bOK = false;
	        		}
	        	} else {
	        		shipAddr = currentRecord.getSublistValue({
		        		sublistId: 'item',
		        		fieldId: 'shipaddress',
		        		line: iLine
		        	});
		    		// Ship To?
		    		if (bOK && shipAddr){
	    				if (!preShipAddr){
	    					preShipAddr = shipAddr;
	    				}
	    				if (!mShipAddr){
	    					mShipAddr = shipAddr;
	    				}
	    				// Excluding Retail Store Form
	    				// DF-11901 Prevent saved when multiple ship to
	    				var currentForm = currentRecord.getValue('customform');
	    				if (currentForm != RETAIL_Store_FORM && shipAddr != preShipAddr){
		    				dialog.alert({
			    				title: "Validate SO Item Lines Multiple Line Ship To",
			    				message: "Direct Order cannot be saved with different Line Ship To Addresses: " + shipAddr + ", " + preShipAddr
			    			});
		    				bOK = false;
	    				}
	    				// Get Address Detail?
	    				if (bOK && !addrDetails){
	    					addrDetails = lib.SearchCustomerAddrID(iCust, shipAddr);
	    					if (!mShipAddr && addrDetails && addrDetails.addrId){
		    					mShipAddr = addrDetails.addrId;
		    				}
	    				}
	    				//*** PO BOX?
		    			if (iChannel === CONSTANT_CHANNEL_DIRECT){
		    				if (addrDetails.shipAddress || addrDetails.addr1){
		    					var bFound = findPOBOX(addrDetails.shipAddress);
		    					if (bFound === true){
		    						dialog.alert({
		    		    				title: "ERROR! PO BOX Found",
		    		    				message: "Cannot Ship To PO Box! Shipping Address=" + addrDetails.shipAddress + ', addr1=' + addrDetails.addr1 + ', State=' + addrDetails.state + ', zip=' + addrDetails.zip
		    		    			});
		    						bOK = false;
		    					}
		    				}
		    			}
	    				// Progressive Leasing -     	
	    		    	//"2. Checking Qualified Ship To State..." + '\n'
	    		    	if (bOK && bLeasing === true){
	    		    		// Validate Ship To State
	    		    		if (addrDetails && addrDetails.state){	    		    			
		    		    		if (addrDetails.state === CONSTANT_NO_LEASING_STATE) {
		    		    			dialog.alert ({
		    		    				title : "Invalid Leasing Ship To State",
		    		    				message : "Ship To state is not allowed for the Leasing option" + '\n'
		    		    				+ "Please select different Payment option!"
		    		    			});
		    		    			bOK = false;
		    		    		}    		
	    		    		}	    		    		
	    		    	}	    	
	    		    	var sItem = currentRecord.getSublistText({
							sublistId: 'item',
							fieldId: 'item',
							line: iLine
						});
	    				// Ship Via?
	    		    	var ShipVia;
	    				if (bOK === true){
	    					ShipVia = currentRecord.getSublistValue({
	    		        		sublistId: 'item',
	    		        		fieldId: 'shipmethod',
	    		        		line: iLine
	    		        	});
	    					//DF-11728: Blank Ship via on Retail Store orders throw an error when ship via is blank
//	    					if (!ShipVia && currentForm != RETAIL_Store_FORM){
    						// DF-11729 Only Validate for Progressive Form
    						if (!ShipVia && lib.inArray(arrLeasingForms, currentForm)){
    							dialog.alert ({
	    		    				title : "Cannot Save Order!",
	    		    				message : "Ship Via is Blank or Invalid at Line # " + iLine + ", Item=" + sItem
	    		    			});
	    						bOK = false; 
    						}
	    				}
	    				// Location
	    				if (bOK === true){
	    					var lnLocation = currentRecord.getSublistValue({
	    						sublistId: 'item',
	    						fieldId: 'location',
	    						line: iLine
	    					});
	    					if (!lnLocation){
	    						dialog.alert ({
	    		    				title : "Cannot Save Order!",
	    		    				message : "Location is Blank or Invalid at Line # " + iLine + " Item: " + sItem
	    		    			});
	    						bOK = false;
	    					}
	    				}
		    		} else {	    			
		    			dialog.alert ({
		    				title : "Ship To is BLANK",
		    				message : "Ship To Address is Blank or Invalid at Line " + iLine + '\n'
		    				+ "Please select Ship To!"
		    			});
						bOK = false;  
		    		}
	        	}
    		} // bOK = true
    	}
    	
    	return bOK;
    }
    
    function ResetShipCompleteDCLoc(currentRecord, itemCount, sSubsidiary, channel)
    {
    	var custShipToZip;
    	var sState;
		var arrItems = new Array();
    	for (var iLine = 0; iLine < itemCount; iLine++){
    		// Item Type
    		var stItemType = currentRecord.getSublistValue({
        		sublistId: 'item',
        		fieldId: 'itemtype',
        		line: iLine
        	});	    		
        	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
//	        		dialog.alert ({
//	    				title : "NLS_SaveRecord",
//	    				message : "stItemType= " + stItemType + ', Not Support - Continue...'
//	    			});        	
        	} else {
        		var shipAddr = currentRecord.getSublistValue({
	        		sublistId: 'item',
	        		fieldId: 'shipaddress',
	        		line: iLine
	        	});
	    		// Search customer Address ?
	    		if (shipAddr && !custShipToZip){
	    			if (!mShipAddr){
	    				mShipAddr = shipAddr;
	    			}
	    			if (!addrDetails){
	    				var iCust = currentRecord.getValue({
		    	    		fieldId: 'entity'
		    	    	});
	    				addrDetails = lib.SearchCustomerAddrID(iCust, shipAddr);
	    				if (!mShipAddr && addrDetails && addrDetails.addrId){
	    					mShipAddr = addrDetails.addrId;
	    				}
	    			}	    			
	    			if (addrDetails){
		    			custShipToZip = addrDetails.zip;
		    			sState = addrDetails.iState;		    			
	    			}
	    		}
	    		
    			if (custShipToZip){
    				if (!iDirUSRegion){
//    					iDirUSRegion = lib.SearchDirectRegion(custShipToZip);
    					var oRegion = lib.SearchDirectRegion(custShipToZip);
    					if (oRegion && oRegion.count > 0){
    						iDirUSRegion = oRegion.iRegion;    						
    					}
    					if (!iDirUSRegion){
    	    				iDirUSRegion = '@NONE@';    	    				
    	    			}
    				}
	    			var idItem = currentRecord.getSublistValue({
			    		sublistId: 'item',
			    		fieldId: 'item',
		        		line: iLine
			    	});
					arrItems.push(idItem);
    			}
        	} // Inventory Line
    	}	// End of iLine loop    	
    	
		// ONLY if we have more than 1 inventory items
    	if (arrItems && arrItems.length > 1){
//    		dialog.alert({
//				title: 'NLS_SaveRecord custShipToZip=' + custShipToZip,
//				message: "arrItems Count= " + arrItems.length + ', sSubsidiary=' + sSubsidiary + ', channel=' + channel + ', iDirUSRegion=' + iDirUSRegion + ', itemCount=' + itemCount
//			});
    		
    		// Search Location Config for Common DC in the order: SearchCommonLocDC(arrItems, sSubsidiary, channel, region)
    		var sCommonDC = lib.SearchCommonLocDC(arrItems, sSubsidiary, channel, iDirUSRegion);
    		
			if (sCommonDC){
				for (var jLine = 0; jLine < itemCount; jLine++){
					// Item Type
		    		var itemType = currentRecord.getSublistValue({
		        		sublistId: 'item',
		        		fieldId: 'itemtype',
		        		line: jLine
		        	});	    		
		        	if (lib.inArray(arNotSupprtedItemTypes, itemType)) {
//			        		dialog.alert ({
//			    				title : "NLS_SaveRecord",
//			    				message : "stItemType= " + stItemType + ', Not Support - Continue...'
//			    			});        	
		        	} else {
			    		// Get Line DC
			    		var itemDC = currentRecord.getSublistValue({
				    		sublistId: 'item',
				    		fieldId: 'custcol_nls_distribution_center',
				    		line: jLine
				    	});
						if (itemDC != sCommonDC){
							var createdPOb = false;
	//						var createPOb = nlapiGetLineItemValue('item', 'createpo',r);
							var createPOb = currentRecord.getSublistValue({
					    		sublistId: 'item',
					    		fieldId: 'createpo',
					    		line: jLine
					    	});
							
						    if (createPOb == 'SpecOrd') {
								createdPOb = true;
							}
						    var itemID = currentRecord.getSublistValue({
						    	sublistId: 'item',
						    	fieldId: 'item',
						    	line: jLine
						    });
						    // SearchItemDCLocation(itemID, subsidiary, channel, dropShipRetailer, createdPOb, sCommonDC) 
							var objNewLoc = lib.SearchItemDCLocation(itemID, sSubsidiary, channel, false, createdPOb, sCommonDC);
							var newLocation = objNewLoc.location;
							if (newLocation) {
	//							nlapiSelectLineItem('item', r);
								currentRecord.selectLine({
									sublistId: 'item',
									line: jLine
								});
	//							nlapiSetCurrentLineItemValue('item', 'custcol_nls_distribution_center', sCommonDC);
								currentRecord.setCurrentSublistValue({
						    		sublistId: 'item',
						    		fieldId: 'custcol_nls_distribution_center',
						    		value: sCommonDC
						    	});
	//							nlapiSetCurrentLineItemValue('item', 'location', newLocation);
								currentRecord.setCurrentSublistValue({
						    		sublistId: 'item',
						    		fieldId: 'location',
						    		value: newLocation
						    	});
	//							nlapiCommitLineItem('item');
								// Commit the Item
								currentRecord.commitLine({
									sublistId: 'item'
								});
								dialog.alert({
				    				title: "Line DC & Location Updated for Ship Complete order",
				    				message: "Line Item " + jLine + ', Updated DC=' + sCommonDC + ', newLocation=' + newLocation
				    			});															
							}
						}
		        	}
				}
			}
    	}
    	return true;
    }
    /**
     * Client Validate Line - Expedite Shipping Project
     * 1. Check Ship to State if it is eligible for expedite shipping
     * 2. Check line item if it is eligible for expedite shipping
     * @param currentRecord
     * @param shipState
     * @param subsidiary
     * @returns
     */
    function ValidateExpediteShipping(currentRecord, shipState, subsidiary){
// 		item Ship Types: 2 - Flag Rate, 1 - Banded
    	var bOK = true;
    	var sublistName = 'item';
    	var sMsg = '';
    	var sTitle = '';
    	// Mode of Transport (2nd, expedite)
    	var sMOT = currentRecord.getValue({
    		fieldId: 'custbody_nls_mode_of_transport'
    	});
    	if (sMOT === MOT_Expedited_2DA || sMOT === MOT_Expedited_Overnight) {
//    		if (shipState === 'HI' || shipState === 'AK' || shipState === 'PR') {
    		if (lib.inArray(arrNonExpediteState, shipState)) {
				bOK = false;
				sTitle = "MOT ERROR - Invalid State";
				sMsg = "Shipping Mode of Transport (MOT): " + sMOT + " is Not eligible for State=" + shipState;				
			} else {
				var sItem = currentRecord.getCurrentSublistText({
	                sublistId: sublistName,
	                fieldId: 'item'
	            });	
				var itemShipType = currentRecord.getCurrentSublistValue({
		            sublistId: sublistName,
		            fieldId: 'custcol_shipping_type'
		        });		
//				var bExpedited = nlapiGetLineItemValue('item', 'custcol_nls_isexpedited', index);
//				var bExpedited_CA = nlapiGetLineItemValue('item', 'custcol_nls_isexpedited_ca', index);
				var bExpedited = currentRecord.getCurrentSublistValue({
		            sublistId: sublistName,
		            fieldId: 'custcol_nls_isexpedited'
		        });
				var bExpedited_CA = currentRecord.getCurrentSublistValue({
		            sublistId: sublistName,
		            fieldId: 'custcol_nls_isexpedited_ca'
		        });
				
		//		if (itemShipType == '1' || itemShipType == '2'  || itemShipType == '3') {
				if (lib.inArray(arrSupportedShipType, itemShipType)) {
					sTitle = "MOT ERROR - Item Not eligible";
					if (subsidiary === CONSTANT_SUBSIDIARY_US && bExpedited === false) {
						bOK = false;						
						sMsg = "Item is not eligible for US Expedited Mode of Transport (MOT):\n" + sMOT + ", Item = " + sItem;
					}
					//*** DF-9537 Item Eligible for Expedited to Canada - Banded
					if (subsidiary === CONSTANT_SUBSIDIARY_CA && itemShipType === SHIP_TYPE_BANDED) {
						bOK = false;
						sMsg = "Banded Item shipped to Canada is not eligible for Expedited Mode of Transport (MOT):\n" + "Item: " + sItem;				
					}
					//*** DF-9537 Item Eligible for Expedited to Canada - Flat rates
					if (subsidiary === CONSTANT_SUBSIDIARY_CA && bExpedited_CA === false) {
						bOK = false;
						sMsg = "Item shipped to Canada is not eligible for Expedited Mode of Transport (MOT):\n" + "Item: " + sItem;						
					}
				}    	
			}
    		if (bOK === false){
    			dialog.alert ({
					title : sTitle,
					message : sMsg
				});		
    		}
		}
    	return bOK;
    }
    /**
     * Field Changed: re-calculate ship Via, Shipping rates, discount shipping when Mode Of Transport field changed
     * @param currentRecord
     * @returns Commit Line - Ship Group
     */
    function RecalculateItems(currentRecord){
    	var sMOT = currentRecord.getValue('custbody_nls_mode_of_transport');  
		var itemCount = currentRecord.getLineCount('item');
		for (var iLine = 0; iLine < itemCount; iLine++){
    		// Item Type
    		var stItemType = currentRecord.getSublistValue({
        		sublistId: 'item',
        		fieldId: 'itemtype',
        		line: iLine
        	});	    		
        	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
        		// SKIP the line
        	} else {
    			//*1. Commit Item subList: Update Item Line Discount Shipping rate
    			currentRecord.selectLine({
					sublistId: 'item',
					line: iLine
				});

//    			currentRecord.setCurrentSublistValue({
//		    		sublistId: 'item',
//		    		fieldId: 'custcol_nls_discounted_shipping_rate',	    		    		
//		    		value: 0
//		    	});
//    			dialog.alert ({
//    				title : "RecalculateItems stItemType=" + stItemType,
//    				message : 'iLine=' + iLine + ', newShipVia=' + newShipVia
//    			});
				currentRecord.commitLine({
					sublistId: 'item'
				});
        	}
    	}
    }
    /**
     * Replace NLS_SetPromo_ItemCountUp.js
     * Setting Promotion field based on the priority of the 3 custom coupon code fields
     * @param currentRecord
     * @param fieldName - Field Changed event on 3 custom coupon code on sales order
     * @returns true
     */
    function setPromoCode(currentRecord, fieldName){
    	var callCenterPromoCode = currentRecord.getValue('custbody_nls_cc_promocode');
    	var managerOverridePromoCode = currentRecord.getValue('custbody_nls_mo_promocode');
    	var webPromoCode = currentRecord.getValue('custbody_nls_web_promocode');
    	var usePromoCode = currentRecord.getValue({
			fieldId: fieldName
		});
    	switch (true) {
			case (!callCenterPromoCode && !managerOverridePromoCode):
				usePromoCode = webPromoCode;
				break;
			case (!managerOverridePromoCode):
				usePromoCode = callCenterPromoCode;
				break;	
			default:
				if (managerOverridePromoCode){
					usePromoCode = managerOverridePromoCode;
				}
				break;
		}
		// Select Promotion 
		currentRecord.setValue({
			fieldId: 'promocode',
			value: usePromoCode,
			ignoreFieldChange: false,
		    fireSlavingSync: true
		});
		
    	return true;
    }
    /**
     * Field Changed: loop Item lines and shipping line and re-calculate shipping rate, when Promotion field changed
     * @param currentRecord
     * @returns Commit lines: Item, Ship Group
     */
    function RecalculateItemsShipGroups(currentRecord, objLeasing){    	    	
    	//*1. FOR Item Loop
    	var itemCount = currentRecord.getLineCount('item');
    	for (var iLine = 0; iLine < itemCount; iLine++){
    		// Item Type
    		var stItemType = currentRecord.getSublistValue({
        		sublistId: 'item',
        		fieldId: 'itemtype',
        		line: iLine
        	});	    		
        	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
//        		dialog.alert ({
//    				title : "NLS_FieldChanged fieldName=" + fieldName,
//    				message : "stItemType= " + stItemType + ', Not Support - Continue...'
//    			});        	
//    			continue;
        	} else {
    			//*1. Commit Item subList: Update Item Line Discount Shipping rate
    			currentRecord.selectLine({
					sublistId: 'item',
					line: iLine
				});
    			// Force discount rate change
    			// Shipping Discount Rate
    			var fRate = 0;
//    			if (objLeasing && !objLeasing.bLeasing){
//	    			// Force discount rate change
//	    			fRate = currentRecord.getCurrentSublistValue({
//	    				sublistId: 'item',
//			    		fieldId: 'custcol_nls_shipping_rate'
//	    			});
//	    			fRate = lib.forceParseFloat(fRate);
//    			}
    			
    			
//				currentRecord.setCurrentSublistValue({
//		    		sublistId: 'item',
//		    		fieldId: 'custcol_nls_discounted_shipping_rate',	    		    		
//		    		value: 0
//		    	});
				
				// DF-11872: "J" code not added on Edit when promotion is on a PL order
				// Line SHip to Entity Use Code - Edit order with header promo = C1H and only change payment to PL				
				if (objLeasing && objLeasing.bLeasing){
					currentRecord.setCurrentSublistValue({
			            sublistId: 'item',
			            fieldId: 'custcol_ava_shiptousecode',
			            value: CONSTANT_LEASING_EXEMPT_CODE
			        });
				} else {
					currentRecord.setCurrentSublistValue({
			            sublistId: 'item',
			            fieldId: 'custcol_ava_shiptousecode',
			            value: ''
			        });
				}
				currentRecord.commitLine({
					sublistId: 'item'
				});
        	}
    	}
    	
    	//2. FOR Shipping Loop
    	var shipCount = currentRecord.getLineCount('shipgroup');    	
    	for (var jLine = 0; jLine < shipCount; jLine++){
	    	//*2. Commit Ship Group sublist
			currentRecord.selectLine({
				sublistId: 'shipgroup',
				line: jLine
			});
//			currentRecord.setCurrentSublistValue({
//	    		sublistId: 'shipgroup',
//	    		fieldId: 'shippingrate',	    		    		
//	    		value: 0
//	    	});
			currentRecord.commitLine({
				sublistId: 'shipgroup'
			});				
    	}
    	mbChangePayment = false;
    	return true;
    }    
    
    function RecalculatePromotion(currentRecord, objLeasing){
    	var itemCount = currentRecord.getLineCount('item');
    	var shipAddr;
	    if (itemCount && itemCount > 0){
	    	//*1. FOR Item Loop    	
	    	for (var iLine = 0; iLine < itemCount; iLine++){
	    		// Item Type
	    		var stItemType = currentRecord.getSublistValue({
	        		sublistId: 'item',
	        		fieldId: 'itemtype',
	        		line: iLine
	        	});	    		
	        	if (lib.inArray(arNotSupprtedItemTypes, stItemType)) {
	//        		dialog.alert ({
	//    				title : "NLS_FieldChanged fieldName=" + fieldName,
	//    				message : "stItemType= " + stItemType + ', Not Support - Continue...'
	//    			});        	
	//    			continue;
	        	} else {
	        		var iAddr = currentRecord.getCurrentSublistValue({
		        		sublistId: 'item',
		        		fieldId: 'shipaddress'
		        	});	 
	        		if (iAddr){
	        			shipAddr = iAddr;
	        		} 
//	        		alert("RecalculatePromotion shipAddr=" + shipAddr + ", iLine=" + iLine + ", iAddr=" + iAddr + ", mShipAddr=" + mShipAddr);
	    			//*1. Commit Item subList: Update Item Line Discount Shipping rate
	    			currentRecord.selectLine({
						sublistId: 'item',
						line: iLine
					});
	    			// Shipping Discount Rate
	    			var fRate = 0;
//	    			if (objLeasing && !objLeasing.bLeasing){
//		    			// Force discount rate change
//		    			fRate = currentRecord.getCurrentSublistValue({
//		    				sublistId: 'item',
//				    		fieldId: 'custcol_nls_shipping_rate'
//		    			});
//		    			fRate = lib.forceParseFloat(fRate);
//	    			}
					currentRecord.setCurrentSublistValue({
			    		sublistId: 'item',
			    		fieldId: 'custcol_nls_discounted_shipping_rate',	    		    		
			    		value: fRate
			    	});
					// Line SHip to Entity Use Code
//					if (objLeasing && objLeasing.bLeasing){
//						currentRecord.setCurrentSublistValue({
//				            sublistId: 'item',
//				            fieldId: 'custcol_ava_shiptousecode',
//				            value: CONSTANT_LEASING_EXEMPT_CODE
//				        });
//					}
					currentRecord.commitLine({
						sublistId: 'item'
					});
	        	}
	    	}
	    	
	    	//2. FOR Shipping Loop
	    	var shipCount = currentRecord.getLineCount('shipgroup');    	
	    	for (var jLine = 0; jLine < shipCount; jLine++){
		    	//*2. Commit Ship Group sublist
				currentRecord.selectLine({
					sublistId: 'shipgroup',
					line: jLine
				});
//				var sRate = currentRecord.getCurrentSublistValue({
//					sublistId: 'shipgroup',
//		    		fieldId: 'shippingrate'
//				});
//				sRate = lib.forceParseFloat(sRate) + 1;
//				currentRecord.setCurrentSublistValue({
//		    		sublistId: 'shipgroup',
//		    		fieldId: 'shippingrate',	    		    		
//		    		value: 0
//		    	});
				currentRecord.commitLine({
					sublistId: 'shipgroup'
				});				
	    	}
	    	mbChangePayment = false;
	    }
    	return true;
    }    
    
    function SetHeaderTaxUseCode(currentRecord, obLeasing){
    	// Set Header Level Ship To Entity Use Code
    	var isMultiShip = currentRecord.getValue('ismultishipto');
    	if (obLeasing && isMultiShip === true) {
//    		alert("SetHeaderTaxUseCode bHasPayment=" + obLeasing.bHasPayments + ", obLeasing.bOK=" + obLeasing.bOK + ", bLeasing" + obLeasing.bLeasing);
	    	if (obLeasing.bHasPayments && obLeasing.bOK && obLeasing.bLeasing) {    		
				// Header Level Ship To Entity Use Code
	    		var discRate = currentRecord.getValue('discountrate');
	    		var discItem = currentRecord.getValue('discountitem');
	    		var shipAddr = obLeasing.shipAddr;
	    		var curEntityID = currentRecord.getValue('custbody_ava_shiptousecode');
	    		
	    		if (shipAddr && (discRate || discItem)) {
//	    		if (shipAddr) {
//	    			alert("Set Order SHIP-TO Entity Use Code discRate=" + discRate + ", discItem=" + discItem + ", shipAddr=" + shipAddr + ", curEntityID=" + curEntityID);
	    			// Ship To List
	    			if (!curEntityID){
		    			currentRecord.setValue({
		    				fieldId: 'shipaddresslist',
		    				value: shipAddr
		    			});
		    			// Header Entity Use Code
			    		currentRecord.setValue({
			    			fieldId: 'custbody_ava_shiptousecode',
			    			value: CONSTANT_LEASING_EXEMPT_CODE
			    		});
	    			}
	    		}
	    		else {
	    			currentRecord.setValue({
	        			fieldId: 'custbody_ava_shiptousecode',
	        			value: ''
	        		});
	    		}
			} else {
				currentRecord.setValue({
	    			fieldId: 'custbody_ava_shiptousecode',
	    			value: ''
	    		});
			}
    	}
    	return true;
    }
    /**
     * Set Location based on Ship To, Item, Subsidiary, Channel 
     * @param currentRecord
     * @param sSubsidiary
     * @param iChannel
     * @param custShipToZip
     * @param idItem
     * @returns bFoundLoc
     */
    function SetLineLocation(currentRecord, sSubsidiary, iChannel, custShipToZip, idItem, sState){    	
	    var bFoundLoc = false;
    	if (iChannel === CONSTANT_CHANNEL_DIRECT && sSubsidiary === CONSTANT_SUBSIDIARY_US){
    		if (!iDirUSRegion){    			
//    			iDirUSRegion = lib.SearchDirectRegion(custShipToZip);
    			var objRegion = lib.SearchDirectRegion(custShipToZip);
    			if (objRegion && objRegion.count > 0){
    				iDirUSRegion = objRegion.iRegion;
    				iRegionID = objRegion.id;
    			}

//    			dialog.alert({
//    				title: 'SetLineLocation  custShipToZip=' + custShipToZip,
//    				message: "Search Direct Region iDirUSRegion= " + iDirUSRegion + ', preRegion=' + oRegion.preRegion + ', iRegion=' + oRegion.iRegion + ', sState=' + sState + ', count=' + oRegion.count
//    			});    			
    		}
    	}
    	if (!iDirUSRegion){
			iDirUSRegion = '@NONE@';
		}
    	var createPO = currentRecord.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'createpo'
        });
    	var bSpecOrd = false;
	    if (createPO == 'SpecOrd') {
			bSpecOrd = true;
		}
	    
	    // Drop Ship : custbody_nls_drop_ship_retailer
	    var bDropShip = currentRecord.getValue('custbody_nls_drop_ship_retailer');
	    // Item Shared? DC?
	    var itemSearch = lib.SearchItemDCFields(idItem);
	    if (itemSearch) {
	    	var bShared = itemSearch.getValue('custitem_nls_shared_item');
	    	var bOhioDC = itemSearch.getValue('custitem_nls_ohio_dc');
	    	var bPortDC = itemSearch.getValue('custitem_nls_portland_dc');
	    	var bCandaDC = itemSearch.getValue('custitem_nls_winnipeg_dc');
	    }
//	    dialog.alert ({
//			title : "SetLineLocation idItem=" + idItem,
//			message : "DEBUGGER iDirUSRegion= " + iDirUSRegion + ', iChannel=' + iChannel + ', sSubsidiary=' + sSubsidiary
//			+ ', bSpecOrd=' + bSpecOrd + ', bDropShip=' + bDropShip + ', bShared=' + bShared + ', bOhioDC=' + bOhioDC + '. bPortDC=' + bPortDC + ', bCandaDC=' + bCandaDC
//		});    
	    if (idItem && sSubsidiary && iChannel){
			var objLocResult = lib.SearchLocationConfig(idItem, sSubsidiary, iChannel, iDirUSRegion, bSpecOrd, bShared, bDropShip);
			if (objLocResult && objLocResult.count > 0){
	    		var oResult = objLocResult.result;
				var curLoc = oResult.getValue('custrecord_loc_config_location');
				var iDC = oResult.getValue('custrecord_loc_config_distr_center');
				
				// Set Location
				if (curLoc){
					currentRecord.setCurrentSublistValue({
			            sublistId: 'item',
			            fieldId: 'location',
			            value: curLoc
			        });
					bFoundLoc = true;
				}
				// Set Distribution Center
				if (iDC){
					currentRecord.setCurrentSublistValue({
			            sublistId: 'item',
			            fieldId: 'custcol_nls_distribution_center',
			            value: iDC
			        });
				}
				// Set Region
				if (iRegionID){
					currentRecord.setCurrentSublistValue({
			            sublistId: 'item',
			            fieldId: 'custcol_nls_region',
			            value: iRegionID
			        });
				}
			} else {
				// Alert
				var sItem = currentRecord.getCurrentSublistText({
					sublistId: 'item',
					fieldId: 'item'
				});
				alert ("ERROR! Cannot find Location Config for line Item: " + sItem + ', sSubsidiary=' + sSubsidiary + ', Channel=' + iChannel);
			}
	    }
//		return bFoundLoc;
	    return true;
    }
    /**
     * Recalculate Shipping rates at shipping sublist by Ship From (location) and Ship Via: Banded and Flat and White Glove
     * @param currentRecord
     * @param sublistName
     * @param sMOT
     * @param Country
     * @param shipVia
     * @param sPromo
     * @returns
     */
    function SetShipGroupRate(currentRecord, sublistName, bLeasing){
    	// Called from "Calculate" button clicked for shipping total at Validate Line function
    	var totalFreight = 0;    	
    	if (!bLeasing){
	    	var sPromo = currentRecord.getValue('promocode');
	    	var shipVia = currentRecord.getCurrentSublistValue({
	    		sublistId: sublistName,
	    		fieldId: 'shippingmethodref'
	    	});
	    	var sSubsidiary = currentRecord.getValue('subsidiary');
	    	var sMOT = currentRecord.getValue({        		
	    		fieldId: 'custbody_nls_mode_of_transport'
	    	});
	    	var Country = 'US';
			// Global Banded Ship Via array
			if (lib.inArray(arrBandedShipVia, shipVia)) {			
	    		if (sSubsidiary === CONSTANT_SUBSIDIARY_CA){
	    			Country = 'CA';
	    		}    		
			}
	    	 	
	    	var shipTaxCode = currentRecord.getCurrentSublistValue({
	    		sublistId: sublistName,
	    		fieldId: 'shippingtaxcode'
	    	});
	    	var shipFrom = currentRecord.getCurrentSublistValue({
	    		sublistId: sublistName,
	    		fieldId: 'sourceaddressref'
	    	});
	    	var shipTo = currentRecord.getCurrentSublistValue({
	    		sublistId: sublistName,
	    		fieldId: 'destinationaddressref'
	    	});
	    	var shipRate = currentRecord.getCurrentSublistValue({
	    		sublistId: sublistName,
	    		fieldId: 'shippingrate'
	    	});
	    	// Adding Item discount shipping
	    	var itemCount = currentRecord.getLineCount('item');
	    	var bandedAmount = 0;
	    	for (var iLine = 0; iLine < itemCount; iLine++){
	    		// Item Ship Via
	    		var curVia = currentRecord.getSublistValue({
		    		sublistId: 'item',
		    		fieldId: 'shipmethod',
		    		line: iLine
		    	});
	    		if (curVia){
			    	var curRate = currentRecord.getSublistValue({
			    		sublistId: 'item',
			    		fieldId: 'custcol_nls_discounted_shipping_rate',
			    		line: iLine
			    	});
			    	if (curRate){
			    		curRate = lib.forceParseFloat(curRate);
			    	} else {
			    		curRate = 0;
			    	}
			    	if (bLeasing && curRate > 0){
				    	currentRecord.setCurrentSublistValue({
			    	        sublistId: 'item',
			    	        fieldId: 'custcol_nls_discounted_shipping_rate',
			    	        value: curRate
			    	    }); 
			    	}
			    	var curLoc = currentRecord.getSublistValue({
			    		sublistId: 'item',
			    		fieldId: 'location',
			    		line: iLine
			    	});
			    	var curShipTo = currentRecord.getSublistValue({
			    		sublistId: 'item',
			    		fieldId: 'shipaddress',
			    		line: iLine
			    	});
			    	// Banded Amount
			    	var curAmount = currentRecord.getSublistValue({
			    		sublistId: 'item',
			    		fieldId: 'amount',
			    		line: iLine
			    	});
			    	
			    	if (shipVia === curVia && shipFrom === curLoc && shipTo === curShipTo){
	//			    	if (curVia === CONSTANT_SHIPPING_METHOD_BANDED_SHIPPING || curVia === CONSTANT_SHIPPING_METHOD_BANDED_SHIPPING_CA){
			    		if (lib.inArray(arrBandedShipVia, shipVia)) {
				    		bandedAmount += lib.forceParseFloat(curAmount);
		//		    		totalFreight += lib.forceParseFloat(shipRate);
				    	} else {
				    		totalFreight += lib.forceParseFloat(curRate);
				    	}
			    	}
//			    	alert("DEBUGGER - Calculating Line Shipping iLine: " + iLine + ", curRate=" + curRate + ", totalFreight=" + totalFreight + ", shipFrom=" + shipFrom + ", shipVia=" + shipVia 
//						+ ", curVia=" + curVia + ", curLoc=" + curLoc + ", bandedAmount=" + bandedAmount + ", shipTo=" + shipTo + ", curShipTo=" + curShipTo);					
	    		}
	    	}
	    	  	
	    	// Calculate Banded shipping
	    	if (bandedAmount > 0 && sMOT && Country){    		
	    		var NLS_bandedTotal = lib.SearchBandedShippingRate(bandedAmount, sMOT, Country);
	    		var bandedFreight = 0;
	    		if (NLS_bandedTotal){
	    			bandedFreight = lib.forceParseFloat(NLS_bandedTotal);
	    		}
	    		
	    		//** Parameters: idItem = '', iQty = 1;
	    		totalFreight = CalculateShipPromo(sPromo, shipVia, bandedFreight, '', 1);    		
	    	}    	
    	}
//    	dialog.alert ({
//			title : 'setShipGroupRate bLeasing=' + bLeasing,
//			message : 'totalFreight=' + totalFreight + ", bandedAmount=" + bandedAmount + ", shipVia=" + shipVia + ", shipTaxCode=" + shipTaxCode
//			+ ", shipFrom=" + shipFrom + ", shipRate=" + shipRate + ", NLS_bandedTotal=" + NLS_bandedTotal + ", sMOT=" + sMOT + ", Country=" + Country 
//		});    	
    	
	    currentRecord.setCurrentSublistValue({
	        sublistId: sublistName,
	        fieldId: 'shippingrate',
	        value: totalFreight
	    });    	
    	
    	return true;
    }
    /**
     * Set current Line Item Ship Via, Shipping Rate (custom), and Discount Shipping Rate for Flat/White Glove and Banded Item
     * @param currentRecord
     * @param sublistName (Item)
     * @param custShipToZip
     * @param idItem
     * @param sSubsidiary
     * @param sPromo
     * @returns
     */
    function SetCurrentLineItemShipping(currentRecord, sublistName, custShipToZip, idItem, sSubsidiary, sPromo, bLeasing){
    	var bOK = true;
    	// Department : Warranty Order
    	var bWarrantyOrder = false;
    	var stDepartment = currentRecord.getValue('department');
//    	if (stDepartment != '80' && stDepartment != '86'){
//    	if (lib.inArray(arrBandedShipVia, shipVia)) {
    	if (lib.inArray(arrWarrantyDepartments, stDepartment)) {
			bWarrantyOrder = true;
		}
    	
    	// Ship Type    	
    	var itemShipType = currentRecord.getCurrentSublistValue({
            sublistId: sublistName,
            fieldId: 'custcol_shipping_type'
        });
    	
    	var sItem = currentRecord.getCurrentSublistText({
            sublistId: sublistName,
            fieldId: 'item'
        });        	
//    	var shipAddr = currentRecord.getCurrentSublistValue({
//    		sublistId: sublistName,
//    		fieldId: 'shipaddress'
//    	});
    	var sOQuantity = currentRecord.getCurrentSublistValue({
    		sublistId: sublistName,
    		fieldId: 'quantity'
    	});    	
    	// Mode of Transport (2nd, expedite)
    	var sMOT = currentRecord.getValue({        		
    		fieldId: 'custbody_nls_mode_of_transport'
    	});    	
    	
    	// Set Line Field Values
    	var sShipCarrier = CONSTANT_SHIPPING_CARRIER_MORE;
    	var sShipVia;
    	var dsPerUnitCharge = 0;    	
    	var iQty = 0;
    	if (sOQuantity){
    		iQty = lib.forceParseInt(sOQuantity);
    	}
    	var fShipRate = 0;
    	var fDiscountShip = 0;
    	   	
//		var SHIP_TYPE_FLAT = '2';		var SHIP_TYPE_WHITE_GLOVE = '3';
    	if (itemShipType === SHIP_TYPE_FLAT || itemShipType === SHIP_TYPE_WHITE_GLOVE){
	    	if (custShipToZip){
				// *** Calculate Shipping and Ship Via
    			var objDirectShip = lib.SearchDirectShipping(idItem, sMOT, sSubsidiary, custShipToZip);
    			if (objDirectShip && objDirectShip.count > 0){
    				var arrDirectShip = objDirectShip.result;
    				sShipCarrier = arrDirectShip.getValue('custrecord_nls_shipping_carrier');
    				sShipVia = arrDirectShip.getValue('custrecord_nls_assigned_carrier');
//    				dsPerUnitCharge = lib.forceParseFloat(arrDirectShip.getValue('custrecord_nls_per_unit_shipping_charge'));
    				var sCharge = arrDirectShip.getValue('custrecord_nls_per_unit_shipping_charge');
    				if (sCharge){
    					dsPerUnitCharge = lib.forceParseFloat(sCharge);
    				}
					fShipRate = dsPerUnitCharge * iQty;
    			} else {
//    				bOK = false;
    				alert("ERROR! Cannot find Direct Shipping Method or Rate for Item: " + sItem + ", Ship To Zip:" + custShipToZip + ", MOT=" + sMOT);    					
    			}
			}
    	} else if (itemShipType == '1') {
    		// Banded
    		sShipVia = CONSTANT_SHIPPING_METHOD_BANDED_SHIPPING;
    		if (sSubsidiary != CONSTANT_SUBSIDIARY_US){
    			sShipVia = CONSTANT_SHIPPING_METHOD_BANDED_SHIPPING_CA;
    		}
    		if (sMOT == MOT_Expedited_2DA){
    			if (sSubsidiary == CONSTANT_SUBSIDIARY_US) {
    				sShipVia = CONSTANT_BANDED_SHIPPING_2DA;
    			}
    		}
    		if (sMOT == MOT_Expedited_Overnight){
    			if (sSubsidiary == CONSTANT_SUBSIDIARY_US) {
    				sShipVia = CONSTANT_BANDED_SHIPPING_NEXTDAY;
    			}
    		}
			// Search Banded Shipping based on the amount
			var itemAmount = currentRecord.getCurrentSublistValue({
        		sublistId: sublistName,
        		fieldId: 'amount'
        	});
    	}
    	if (sShipVia){
    		// Ship Carrier Default to More
//	    	currentRecord.setCurrentSublistValue({
//	            sublistId: sublistName,
//	            fieldId: 'shipcarrier',
//	            value: sShipCarrier,
//	        });    		
			// Set Item Ship Via
			currentRecord.setCurrentSublistValue({
	            sublistId: sublistName,
	            fieldId: 'shipmethod',
	            value: sShipVia, 
	            ignoreFieldChange: false,
	            fireSlavingSync: true
	        });
			
	    	// Promotion Shipping Discount
			if (fShipRate){
				fDiscountShip = fShipRate;
			} else {
				fShipRate = 0;
				fDiscountShip = 0;
			}
	    		    	
	    	if (bLeasing === true){
	    		// Progressive Leasing Shipping = 0
	    		fDiscountShip = 0;
	    		// DF-11734: Calculated Tax on Progressive Leasing orders when the Ship to = Hawaii does not reflect order level discounts
	    		// Line Level Ship TO Entity Use Code = J 
	    		currentRecord.setCurrentSublistValue({
		            sublistId: sublistName,
		            fieldId: 'custcol_ava_shiptousecode',
		            value: CONSTANT_LEASING_EXEMPT_CODE
		        });
	    	} else {
	    		// DF-11734: Calculated Tax on Progressive Leasing orders when the Ship to = Hawaii does not reflect order level discounts
	    		// Line Level Ship to Entity Use Code
	    		currentRecord.setCurrentSublistValue({
		            sublistId: sublistName,
		            fieldId: 'custcol_ava_shiptousecode',
		            value: ''
		        });
		    	if (sPromo) {
		    		//*** Calculate Promotion 
		    		if (dsPerUnitCharge > 0){
		    			fDiscountShip = CalculateShipPromo(sPromo, sShipVia, dsPerUnitCharge, idItem, iQty);
		    		} else {
		    			fDiscountShip = 0;
		    		}
		    	}
	    	}
	    	// Warranty order shipping = 0
	    	if (bWarrantyOrder){
	    		// Discount Shippping = 0
	    		fShipRate = 0;
	    		fDiscountShip = 0;
	    	}
	    	
			// Set Item Shipping Rate
			if (fShipRate){
				currentRecord.setCurrentSublistValue({
		            sublistId: sublistName,
		            fieldId: 'custcol_nls_shipping_rate',
		            value: fShipRate
		        });
			}
			// Set Item Discount Shipping Rate
			if (fDiscountShip){
				currentRecord.setCurrentSublistValue({
		            sublistId: sublistName,
		            fieldId: 'custcol_nls_discounted_shipping_rate',
		            value: fDiscountShip
		        });						            
//	            ignoreFieldChange: false,
//	            fireSlavingSync: true
			}
//			alert('SetCurrentLineItemShipping sItem= ' + sItem + ', idItem=' + idItem + ', itemShipType=' + itemShipType + ', sMOT=' + sMOT + ', sOQuantity=' + sOQuantity + ', bWarrantyOrder=' + bWarrantyOrder + ', stDepartment=' + stDepartment
//				+ ', sShipVia=' + sShipVia + ', sShipCarrier=' + sShipCarrier + ', fShipRate=' + fShipRate + ', fDiscountShip=' + fDiscountShip + ', sSubsidiary=' + sSubsidiary + ', bLeasing=' + bLeasing);			
    	} else {
//    		bOK = false;
//    		alert ("ERROR! Ship Via is BLANK for Item: " + sItem);
    	}    	
    	
        return bOK;
    }
    
    /**
     * Calculate Shipping based on the Promotion with qualified Ship Method and Items
     * @param sPromo
     * @param sShipVia
     * @param fUnitShipRate
     * @param soItem
     * @param iQty
     * @returns
     */
    function CalculateShipPromo(sPromo, sShipVia, fUnitShipRate, soItem, iQty) {
    	//	
    	var discShipRate = fUnitShipRate * iQty;

    	var arrAPPromoDisc = lib.SearchAPPromoDisc(sPromo);    	
    	if (arrAPPromoDisc){
    		var bFoundItem = shippingMethodInPromotion(arrAPPromoDisc, sShipVia, soItem);
    		if (bFoundItem == true) {
    			var arrAPPromoShip = lib.SearchAPPromoShip(sPromo);
    			if (arrAPPromoShip){
	    			var promoIsPercentage = arrAPPromoShip.getValue('custrecord_advpromo_sprice_is_percent');
	    			
					if(promoIsPercentage == false){
						fUnitShipRate = lib.forceParseFloat(fUnitShipRate);
					}
					discShipRate = adjustBasedOnPromotion(arrAPPromoShip, fUnitShipRate);
					
					if(promoIsPercentage == false){
						discShipRate = discShipRate * lib.forceParseFloat(iQty);
					}					
					
    			}
//    			dialog.alert ({
//					title : 'CalculateShipPromo soItem= ' + soItem,
//					message : 'sPromo=' + sPromo + ', promoIsPercentage=' + promoIsPercentage + ', sShipVia=' + sShipVia + ', fUnitShipRate=' + fUnitShipRate
//					+ ', discShipRate=' + discShipRate + ', iQty=' + iQty
//				});
				if (discShipRate < 0) {
					discShipRate = 0;
				}	
    		}
    	}
//		nlapiSetCurrentLineItemValue('item', 'custcol_nls_discounted_shipping_rate', discShipRate);
		return discShipRate;
    } 
    
    function shippingMethodInPromotion(resultSM, itemShipVia, stItem)
    {	
    	//* 1. Find qualify shipping Method in Promotion
    	var bFoundPromoItem = false;
    	if (resultSM) {
//    		for (var i = 0; i < resultSM.length; i++) {
			var stSM = resultSM.getValue('custrecord_advpromo_discount_isf_smethod');
			var arrSM = [];
			if (stSM) {
				arrSM = stSM.split(",");
			}
			
//			dialog.alert ({
//				title : '1. shippingMethodInPromotion itemShipVia=' + itemShipVia,
//				message : 'stSM=' + stSM + ', arrSM=' + arrSM + ', promo=' + resultSM.getValue('custrecord_advpromo_discount_promo_code')
//			});
			if (lib.inArray(arrSM, itemShipVia)) {
				var stPromoCode = resultSM.getValue('custrecord_advpromo_discount_promo_code');
				//* 2. Find Items qualify for Shipping Discounted in Promotion
//    			var stPromoItem = nlapiLookupField('promotioncode', stPromoCode, 'custrecord_nls_shipping_discounted_item');    				  		    	
		    	var stPromoItem = lib.SearchPromotionCode(stPromoCode);    		    	
				if (stPromoItem) {
					var arrItems = stPromoItem.split(",");
					if (lib.inArray(arrItems, stItem)) {
						bFoundPromoItem = true;
					}
				}
				else {
					bFoundPromoItem = true;
				}

//		    	dialog.alert ({
//					title : '2. shippingMethodInPromotion After lookup',
//					message : 'stPromoItem=' + stPromoItem + ', stPromoCode=' + stPromoCode + ', bFoundPromoItem=' + bFoundPromoItem
//				});
			}
    	}
    	return bFoundPromoItem;
    }    
    
    function adjustBasedOnPromotion(resultSPD, amount)
    {
    	var adjAmount = '';
    	if (resultSPD) {
    		var promoAmount = resultSPD.getValue('custrecord_advpromo_sprice_amount');
    		var promoIsPercentage = resultSPD.getValue('custrecord_advpromo_sprice_is_percent');

    		if(promoIsPercentage == true) {
    			var flAmount = (1 - lib.forceParseFloat(promoAmount)/100)*parseFloat(amount);
    			adjAmount = flAmount;
    		} else {
    			adjAmount =  lib.forceParseFloat(amount) - lib.forceParseFloat(promoAmount);
    		}
    	} else {
    		adjAmount =  amount;
    	}

    	if (!adjAmount) {
    		adjAmount = 0;
    	}
    	return adjAmount;
    }
    
    function GetItemDCFields(idItem){
    	// Get Item Type
    	var sType = search.Type.KIT_ITEM;
    	var lookupItem = search.lookupFields({
		    type: search.Type.ITEM,
		    id: idItem,
		    columns: ['type']
		});
    	if (lookupItem.type != undefined){
   			var lookItemType = lookupItem.type[0].value;
//   			var sharedItem = lookupItem.custitem_nls_shared_item[0].value;
   			if (lookItemType != sType){
   				sType = search.Type.INVENTORY_ITEM;
   			}
    	}
    	//lookItemType=InvtPart, idItem=29688, sType=inventoryitem, search.Type.ITEM=item, KIT_ITEM=kititem
//    	dialog.alert ({
//			title : 'GetItemDCFields' + ', idItem=' + idItem,
//			message : 'lookItemType=' + lookItemType + ', sType=' + sType + ', search.Type.ITEM=' + search.Type.ITEM + ', KIT_ITEM=' + record.Type.KIT_ITEM
//		});
//    	var recItem;
//    	var bShared;
//    	var lpItem = search.lookupFields.promise({
//		    type: sType,
//		    id: idItem,
//		    columns: ['custitem_nls_shared_item', 'custitem_nls_portland_dc']
//		})
//		.then(function (result) {
//			recItem = result;
//			bShared = result.custitem_nls_shared_item[0].value;			   			
//		})
//		.catch(function onRejected(reason) {
//			throw error.create({
//                name: 'GetItemDCFields Error',
//                message: "LookupField"
//            });
//		});
//    	
////		dialog.alert ({
////			title : 'GetItemDCFields 2',
////			message : 'recItem=' + recItem + ', bShared=' + bShared
////		});
//
//    	return recItem;
    }    
    /**
     * Validate Line Function: Set Alt Sales Amount at Line Item for Commission
     * @param currentRecord
     * @param itemType
     * @returns
     */
    function SetASA(currentRecord, itemType)
    {
		var dASA = 0;
		var bFD = false;
		// Eligible itemType: Inventory Item, Kit/Package, Non-Inventory Item, Service, Discount   				
		if (itemType == 'InvtPart' || itemType == 'Kit' || itemType == 'NonInvtPart' || itemType == 'Service' || itemType == 'Discount') {
			dASA = lib.forceParseFloat(currentRecord.getCurrentSublistValue({
        		sublistId: 'item',
        		fieldId: 'amount'
        	}));
			if (itemType == 'Discount'){
				var sItemName = currentRecord.getCurrentSublistText({
		            sublistId: 'item',
		            fieldId: 'item'
		        });    
				bFD = checkForFreightDiscount(sItemName);
				if (bFD == true){
					dASA = 0;
				}
			}
		}
		
		//*** Update current line's ASA
		if (itemType && dASA) {
//			dialog.alert ({
//				title : 'SetASA bFD = ' + bFD,
//				message : 'itemType=' + itemType + ', dASA=' + dASA
//			});
			currentRecord.setCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'altsalesamt',
				value: dASA
			});
		}
    	return true;	
    }
    
    function DisableLineFields(currentRecord, iLineCount)
    {	// Page Init Function		
		if (!arrDisabledColumns){
			arrDisabledColumns = lib.SearchDisabledColumns();
		}
		var oUser = runtime.getCurrentUser();
		if (!arrEnabledColumns && oUser.id){
			arrEnabledColumns = lib.SearchEnabledColumns(oUser.role);
		}
		alert("DEBUGGER - DisableLineFields oUser.id=" + oUser.id + ", oUser.role=" + oUser.role + " arrDisabledColumns=" + arrDisabledColumns.length + ", arrEnabledColumns=" + arrEnabledColumns.length);
		// Evaluate results and Enable / Disable the Columns
		if (iLineCount > 0 && arrDisabledColumns && arrDisabledColumns.length > 0) {
			
	    	for (var i = 0; i < arrDisabledColumns.length; i++) {
				var objSearchResult = arrDisabledColumns[i];
				if (objSearchResult){
					var fieldID = objSearchResult.getValue('custrecord_disabled_field_id');	
					fieldID = fieldID.toLowerCase();
					alert("DEBUGGER - DisableLineFields i=" + i + ", fieldID=" + fieldID + ", objSearchResult.id=" + objSearchResult.id);
					
					if (fieldID && objSearchResult.id) {						
						var bDisabled = true;
						try{
							var objField = currentRecord.getSublistField({
							    sublistId: 'item',
							    fieldId: fieldID,
							    line: i
							});
							if (objField){
								alert("DEBUGGER - DisableLineFields i=" + i + ", Disabling Found fieldID=" + fieldID);
								objField.isDisable = bDisabled;
							}
						} catch(e) {
				        	alert("ERROR DisableLineFields fieldID=" + fieldID + " Error code: " + e.name + ' Error msg: ' + e.message);				            
				        }
						
					}
				}
			}
		}    	
    }
    
    function EnableLineFields(currentRecord, subList, itemFieldID)
    {	
    	// Post Sourcing on line Item
    	// DF-12567: Price Level, Location & Amount are editable by roles that are not permitted to do so
    	
    	var itemType = currentRecord.getCurrentSublistValue({
    		sublistId: 'item',
    		fieldId: 'itemtype'
    	});
		if (itemType == 'InvtPart' || itemType == 'Kit') {
			if (!arrDisabledColumns){
				arrDisabledColumns = lib.SearchDisabledColumns();
			}
			var oUser = runtime.getCurrentUser();
			if (!arrEnabledColumns && oUser.id){
				arrEnabledColumns = lib.SearchEnabledColumns(oUser.role);
			}
			alert("DEBUGGER - EnableLineFields oUser.id=" + oUser.id + ", oUser.role=" + oUser.role + " arrDisabledColumns=" + arrDisabledColumns.length + ", arrEnabledColumns=" + arrEnabledColumns.length);
			
			if (arrDisabledColumns) {
				var currIndex = currentRecord.getCurrentSublistIndex({
				    sublistId: 'item'
				});
				for (var i = 0; i < arrDisabledColumns.length; i++) {
					var objSearchResult = arrDisabledColumns[i];
					var fieldID = objSearchResult.getValue('custrecord_disabled_field_id');
					var parentID = objSearchResult.id;
//					DF-12567: Price Level, Location & Amount are editable by roles that are not permitted to do so
//					alert("DEBUGGER - EnableLineFields i=" + i + ", currIndex=" + currIndex + ", fieldID=" + fieldID + ", itemFieldID=" + itemFieldID + ", parentID=" + parentID + ", objSearchResult.id=" + objSearchResult.id);					
					var bDisabled = true;
					
					if (fieldID) {						
						fieldID = fieldID.toLowerCase();
						if (arrEnabledColumns) {
							for (var j = 0; j < arrEnabledColumns.length; j++) {
								var parID = arrEnabledColumns[j].getValue('custrecord_par_disabled_col_flds');
								
								if (parID == 3) {
									bPriceDisabled = false;
								}
								if (parentID == parID) {
									bDisabled = false;								
									alert("DEBUGGER - EnableLineFields i=" + i + ", j=" + j + ", parentID=" + parentID + ", parID=" + parID + ", fieldID=" + fieldID + ", bDisabled=" + bDisabled);									
									break;
								}
							}
						}
						// Enable the column
						// DF-12567: Price Level, Location & Amount are editable by roles that are not permitted to do so
//						if (bDisabled === false) {				
							try{
								var objField = currentRecord.getSublistField({
								    sublistId: 'item',
								    fieldId: fieldID,
								    line: currIndex
								});
								
								if (objField){				
									alert("DEBUGGER - Enabled currIndex=" + currIndex + ", fieldID=" + fieldID + ", bDisabled=" + bDisabled + ", objField.isDisable=" + objField.isDisable);
									objField.isDisable = bDisabled;									
								}
							} catch(e) {
					        	alert("ERROR EnableLineFields fieldID=" + fieldID + " Error code: " + e.name + ' Error msg: ' + e.message);				            
					        }
//						}
					}
				}
			}
		}

//		if (arrDisabledColumns) {
//			for (var Dis = 0; Dis < arrDisabledColumns.length; Dis++) {
//				var objSearchResult = arrDisabledColumns[Dis];
//				var fieldID = objSearchResult.getValue('custrecord_disabled_field_id');
////					var parentID = objSearchResult.getValue('internalid');
////					nlapiLogExecution('DEBUG', 'arrDisabledColumns', 'fildid: ' + fildid + ', Parent ID: ' + parentID);
//				if (fieldID === itemFieldID) {
//					// Enable the column				
////						nlapiDisableLineItemField('item', fildid, false);
//					var objField = objRecord.getSublistField({
//					    sublistId: 'item',
//					    fieldId: fieldID,
//					    line: i
//					});
//					objField.isDisable = false;
//					alert("DEBUGGER - Enabled Dis=" + Dis + ", fieldID=" + fieldID + ", itemFieldID=" + itemFieldID);
//				}
//			}
//		}    	
    }
    
    function checkForFreightDiscount(itemName)
    {	
    	var sReject = '';
    	var arrReject = ["Freight", "Shipping"];
    	var iIndex = -1;
    	itemName = itemName.toUpperCase();
    	for (var i = 0; i < arrReject.length; i++) {
    		sReject = arrReject[i].toUpperCase();
    		iIndex = itemName.indexOf(sReject);
    		if (iIndex != -1) {
    			return true;
    		}
    	}	
    	return false;	
    }
    /**
     * Client Validate Line Function - Set FPB Price Level
     * Old Script Name:
     * Old Function Name:
     * @param currentRecord
     * @returns
     */
    function ValidatePriceLevel(currentRecord){
    	// Validate Field: Line Item Price Level - to prevent line to be added
    	// Line Item Validate Field function fires before post sourcing
    	var bOK = true;
    	var newPL;
    	// NS Default: Item Price Level?
		var currentPriceLevel = currentRecord.getCurrentSublistValue({
			sublistId: 'item',
			fieldId: 'price'
		});
//		alert("DEBUGGER - ValidatePriceLevel currentPriceLevel=" + currentPriceLevel);
    	// Price Level = Custom??
    	if(currentPriceLevel !== PRICE_LEVEL_CUSTOM && currentPriceLevel !== PRICE_LEVEL_EMPLOYEE) {
			var headPriceLevel = currentRecord.getValue('price');
			var sPriceLevel;
			var idCustomer = currentRecord.getValue('entity');
			if (!headPriceLevel && idCustomer){
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
			// Default line Item Price Level <> Customer Price Level
			if (headPriceLevel){
				// Customer has Price Level
				var sItem = currentRecord.getCurrentSublistText({
					sublistId: 'item',
					fieldId: 'item'
				});
				if (headPriceLevel == currentPriceLevel)
				{
					// Inventory, Kit only
					var itemID = currentRecord.getCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'item'
					});
					// Find item price level list with Customer price level and Currency
					var Subsidiary = currentRecord.getValue('subsidiary');
					// Currency: US = 1, Canada = 3, China RMB = 5
					var Currency = currentRecord.getValue('currency');
					var arrItemPriceLevels;
					if (itemID && Subsidiary && headPriceLevel && Currency){					
						arrItemPriceLevels = lib.SearchItemPriceLevel(itemID, Subsidiary, headPriceLevel, Currency);
					}
					
					alert("DEBUGGER - ValidatePriceLevel currentPriceLevel=" + currentPriceLevel + ", headPriceLevel=" + headPriceLevel
							+ ", currency=" + Currency + ", itemID=" + itemID + ", arrItemPriceLevels=" + arrItemPriceLevels);
		
					//** Check if customer Price Level is found for the Item 
					if (arrItemPriceLevels && lib.inArray(arrItemPriceLevels, headPriceLevel)) {
						//*** Found it ***
					} else {
						bOK = false;
						
						dialog.alert ({
							title : "ERROR_ITEM_PRICE_LEVEL_NOT_FOUND",					
//							message : "Price Level  for item " + sItem + " is different from that on the Entity record Price Level: " + sPriceLevel + ", Currency=" + Currency
							message : "Customer Price Level NOT FOUND for Item: " + sItem + ", Customer Price Level: " + sPriceLevel
						});
						//*** Update ITEM Price Level ***
						currentRecord.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'price',
							value: PRICE_LEVEL_CUSTOM
						});
					}
				} else {
					// Price Level is NOT the same
					bOK = false;
					dialog.alert ({
						title : "ERROR_PRICE_LEVEL_IS_DIFFERENT",					
						message : "Price Level  for item " + sItem + " is different from that on the Entity Price Level: " + sPriceLevel 
					});
				}
			}else {
				bOK = false;
				dialog.alert ({
					title : "ERROR_CUSTOMER_PRICE_LEVEL_NOT_FOUND",					
					message : "Customer Price Level NOT FOUND Custom ID=" + idCustomer
				});
			}
    	} 
        return bOK;
    }
    
    function SetFOBPriceLevel(currentRecord){
    	// Validate Line - change line item price level to FOB Price Level
    	var bOK = true;
    	var newPL = PRICE_LEVEL_CUSTOM;

    	// Inventory, Kit only
		var itemID = currentRecord.getCurrentSublistValue({
			sublistId: 'item',
			fieldId: 'item'
		});
		var createPO = currentRecord.getCurrentSublistValue({
			sublistId: 'item',
			fieldId: 'createpo'
		});
    	if(itemID && createPO === 'SpecOrd') {
			// Find Customer's Price Level
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
			var currentPriceLevel = currentRecord.getCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'price'
			});
			
			// DF-10628: Items on orders are Defaulting to Next Price Level if Correct Level is Not Defined
			if (headPriceLevel && currentPriceLevel != PRICE_LEVEL_CUSTOM && currentPriceLevel != PRICE_LEVEL_EMPLOYEE)
			{
				// *** Search Price Level ***
				var sItem = currentRecord.getCurrentSublistText({
					sublistId: 'item',
					fieldId: 'item'
				});
				 //= result.getValue('custrecord_fob_price_level');
				var arrFobPriceLevel = lib.SearchFOBPriceLevels(headPriceLevel);
				var errFOB_PL_Title='ERROR_';
				var errFOB_PL_Msg='';
//				alert("DEBUGGER - SetFOBPriceLevel arrFobPriceLevel.length=" + arrFobPriceLevel.length);
				
				if (arrFobPriceLevel && arrFobPriceLevel.length > 0){
					for (var iF = 0; iF < arrFobPriceLevel.length; iF++){
						var fobPL = arrFobPriceLevel[iF].getValue('custrecord_price_level');
						if (fobPL == headPriceLevel){
							newPL = arrFobPriceLevel[iF].getValue('custrecord_fob_price_level');
							break;
						}
					}
					
					if (newPL){
						var Subsidiary = currentRecord.getValue('subsidiary');
						var Currency = currentRecord.getValue('currency');
						var arrItemPriceLevels;
						if (itemID && Subsidiary && newPL && Currency){
							// Currency: US = 1, Canada = 3, China RMB = 5
							arrItemPriceLevels = lib.SearchItemPriceLevel(itemID, Subsidiary, newPL, Currency);
						}
//						alert("DEBUGGER - SetFOBPriceLevel SearchItemPriceLevel currentPriceLevel=" + currentPriceLevel + ", headPriceLevel=" + headPriceLevel + ", createPO=" + createPO 
//								+ ", currency=" + Currency + ", itemID=" + itemID + ", arrItemPriceLevels=" + arrItemPriceLevels);
						
						// 1. Validate Item Price Level
						if (arrItemPriceLevels && lib.inArray(arrItemPriceLevels, newPL)) {
							// *** Update FOB Price Level
							currentRecord.setCurrentSublistValue({
								sublistId: 'item',
								fieldId: 'price',
								value: newPL
							});
						} else {
							// ITEM PRICE LEVEL NOT FOUND ERROR
							bOK = false;
							errFOB_PL_Title += "ITEM_FOB_PRICE_LEVEL_NOT_FOUND";
							errFOB_PL_Msg = "FOB ITEM Price Level NOT FOUND for Item: " + sItem + ", FOB Price Level: " + newPL + ", Customer Price Level=" + headPriceLevel;
						}
					} else {
						bOK = false;
						errFOB_PL_Title += "FOB_PRICE_LEVEL_NOT_FOUND";
						errFOB_PL_Msg = "FOB Price Level not found for Customer Price Level=" + headPriceLevel + ", fobPriceLevel=" + fobPriceLevel;
//						alert("ERROR_FOB_PRICE_LEVEL_NOT_FOUND currentPriceLevel=" + currentPriceLevel + ", custPriceLevel=" + headPriceLevel + ", fobPriceLevel=" + fobPriceLevel);							
					}
					
				} else {
					//*** DF-10628: Price Level NOT FOUND ERROR ***
					bOK = false;
					errFOB_PL_Title += "FOB_PRICE_LEVEL_NOT_FOUND";
					errFOB_PL_Msg = "FOB PRICE LEVEL NOT FOUND - sItem: " + sItem + ", currentPriceLevel=" + currentPriceLevel + ", custPriceLevel=" + headPriceLevel
//					alert("ERROR_FOB_PRICE_LEVEL_NOT_FOUND currentPriceLevel=" + currentPriceLevel + ", custPriceLevel=" + headPriceLevel );		
				}	
				if (!bOK){
					//*** Update ITEM Price Level = Custom ***
					currentRecord.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'price',
						value: PRICE_LEVEL_CUSTOM
					});					
					dialog.alert ({
						title : errFOB_PL_Title,					
						message : errFOB_PL_Msg
					});
				}
			}	
    	} 
        return bOK;
    }
    /**
     * Check ship to address for PO box
     * @param sShipTo = Addr1, ShipAddress
     * @returns
     */
    function findPOBOX(sShipTo)
    {
    	var sReject = '';
    	var arrReject = ["PO ", "P.O.", "PO Box ", "P.O. Box", "P O ", "P. O.", "P O Box", "P. O. Box", "Post Office", "APO ", "A. P. O.", "Army Post Office", "Air Force Post Office", "FPO ", "F. P. O.", "Fleet Post Office", "PostOffice"];
    	var iIndex = -1;	
    	// Find beginning string
    	for (var i = 0; i < arrReject.length; i++) {
    		sReject = arrReject[i].toUpperCase();
    		iIndex = sShipTo.indexOf(sReject);
    		if (iIndex == 0) {		
//    			nlapiLogExecution('DEBUG', 'PO BOX found', 'Index=' + iIndex);
    			return true;
    		}
    	}	
    	// Find mid-string
    	var arrReject1 = [" PO ", " P.O.", " PO Box ", " P.O. Box ", " P O ", " P. O.", " P O Box", " P. O. Box", "Post Office", " APO ", " A. P. O.", "Army Post Office", "Air Force Post Office", " FPO ", "F. P. O.", "Fleet Post Office", " PostOffice"];	
    	var iIndex1 = -1;
    	for (var i = 0; i < arrReject.length; i++) {
    		sReject = arrReject1[i].toUpperCase();
    		iIndex1 = sShipTo.indexOf(sReject);
    		if (iIndex1 != -1) {		
//    			nlapiLogExecution('DEBUG', 'PO BOX found', 'Index1=' + iIndex1);
    			return true;
    		}
    	}
    }
    /**
     * Client Page Init Function - Line Number
     * Old Script Name:
     * Old Script Function:
     * @param currentRecord
     * @returns
     */
    function GetSavedLineNum(currentRecord)
    {	
    	iInitLineCount = currentRecord.getLineCount('item');    	
    	iInitMaxNum = iInitLineCount;
    	var itemCount = currentRecord.getLineCount('item');
    	for (var iLine = 0; iLine < itemCount; iLine++){
    		// Item Type
    		var iCurNum = currentRecord.getSublistValue({
        		sublistId: 'item',
        		fieldId: 'custcol_nls_line_number',
        		line: iLine
        	});	    	
    		if (iCurNum > iInitMaxNum) {
    			iInitMaxNum = parseInt(iCurNum);
    		}
    	}
//    	dialog.alert ({
//			title : 'GetSavedLineNum iCurNum = ' + iCurNum,
//			message : 'iInitLineCount=' + iInitLineCount + ', iInitMaxNum=' + iInitMaxNum + ', itemCount=' + itemCount
//		});
    	return true;
    }
    function UpdateLineEntityUseCode(currentRecord, fieldName){
		var orderUseCode = '';		
		var bCommitItem = false;
		if (fieldName === 'custbody_ava_shiptousecode') {
			orderUseCode = currentRecord.getValue(fieldName);
			//Criteria 1: Only Requested, Cancel, Expected Ship Dates		
			var iLineCount = currentRecord.getLineCount('item');
			// Criteria 2: ONLY when there are order lines
			if (iLineCount > 0) {
				var orderStatus = currentRecord.getText('orderstatus');
				if (orderStatus === 'Pending Approval' || orderStatus === 'Pending Fulfillment') {
					for (var iLine = 0; iLine < iLineCount; iLine++){
			    		// Item Type
			    		var itemType = currentRecord.getSublistValue({
			        		sublistId: 'item',
			        		fieldId: 'itemtype',
			        		line: iLine
			        	});	    	

						if (itemType == 'InvtPart' || itemType == 'Kit') {
							var expDate = currentRecord.getSublistValue({
								sublistId: 'item',
								fieldId: 'expectedshipdate',
								line: iLine
							});
							var lineUseCode = currentRecord.getCurrentSublistValue({
								sublistId: 'item',
								fieldId: 'custcol_ava_shiptousecode'
							});
							
							if (orderUseCode !== lineUseCode) {
				    			currentRecord.selectLine({
									sublistId: 'item',
									line: iLine
								});

				    			// Line SHip to Entity Use Code								
								currentRecord.setCurrentSublistValue({
						            sublistId: 'item',
						            fieldId: 'custcol_ava_shiptousecode',
						            value: orderUseCode
						        });
								
								currentRecord.commitLine({
									sublistId: 'item'
								});
								bCommitItem = true;
							}
						}
					}				
				}
			}
			// Update Shipping Line
			if (bCommitItem){
				//2. FOR Shipping Loop
		    	var shipCount = currentRecord.getLineCount('shipgroup');    	
		    	for (var jLine = 0; jLine < shipCount; jLine++){
			    	//*2. Commit Ship Group sublist
					currentRecord.selectLine({
						sublistId: 'shipgroup',
						line: jLine
					});
					currentRecord.setCurrentSublistValue({
			    		sublistId: 'shipgroup',
			    		fieldId: 'shippingrate',	    		    		
			    		value: 0
			    	});
					currentRecord.commitLine({
						sublistId: 'shipgroup'
					});				
		    	}
			}
		}
    	return true;
    }
    /**
     * Client Field Changed Function - Reset Line Item Dates
     * Old Script Name:
     * Old Function Name:
     * @param currentRecord
     * @param name - Field Name: Request Date, Expected Ship Date, Cancel Date
     * @returns
     */
    function UpdateLineDatesWithHeaderDates(currentRecord, name){
//		if (name == 'custbody_nls_request_date' || name == 'custbody_nswmspoexpshipdate' || name == 'custbody_nls_canceldate') {		
		var dNewDate = null;
		var LineField = null;
		if (name == 'custbody_nls_request_date') {
//    				dNewDate = nlapiGetFieldValue('custbody_nls_request_date');
			dNewDate = currentRecord.getValue('custbody_nls_request_date');
			LineField = 'custcol_nls_request_date';
		} else if (name == 'custbody_nswmspoexpshipdate') {
			dNewDate = currentRecord.getValue('custbody_nswmspoexpshipdate');
			// nlapiSetLineItemValue() function will not work for standard, built-in fields 
			// as Netsuite Help Doc indicate 
			LineField = 'expectedshipdate';				
		} else if (name == 'custbody_nls_canceldate') {
			dNewDate = currentRecord.getValue('custbody_nls_canceldate');
			LineField = 'custcol_nls_cancel_date';
		}
		
		//Criteria 1: Only Requested, Cancel, Expected Ship Dates		
		var iLineCount = currentRecord.getLineCount('item');
		// Criteria 2: ONLY when there are order lines
		if (iLineCount > 0) {
			var iChannel = currentRecord.getValue('custbody_nls_channel');
			//nlapiLogExecution('DEBUG', 'Channel', 'Channel:' + iChannel);
			// Criteria 3: Retail
			if (iChannel === CONSTANT_CHANNEL_RETAIL) {
				// Update ONLY if it is Pending Approval: A or Pending Fulfillment
//					var soStatus = currentRecord.getText('orderstatus');
				var orderStatus = currentRecord.getText('orderstatus');
				// Criteria 4: Order Status = Pending Approval "A" or Pending Fulfillment "B"
//					if (orderStatus === 'A' || orderStatus === 'B') {
				if (orderStatus === 'Pending Approval' || orderStatus === 'Pending Fulfillment') {
					for (var iLine = 0; iLine < iLineCount; iLine++){
			    		// Item Type
			    		var itemType = currentRecord.getSublistValue({
			        		sublistId: 'item',
			        		fieldId: 'itemtype',
			        		line: iLine
			        	});	    	

						if (itemType == 'InvtPart' || itemType == 'Kit') {
							var expDate = currentRecord.getSublistValue({
								sublistId: 'item',
								fieldId: 'expectedshipdate',
								line: iLine
							});
							if (name == 'custbody_nswmspoexpshipdate') {
				    			currentRecord.selectLine({
									sublistId: 'item',
									line: iLine
								});
								currentRecord.setCurrentSublistValue({
						    		sublistId: 'item',
						    		fieldId: 'expectedshipdate',	    		    		
						    		value: dNewDate
						    	});
								currentRecord.commitLine({
									sublistId: 'item'
								});
							}
							else {
								currentRecord.selectLine({
									sublistId: 'item',
									line: iLine
								});
								currentRecord.setCurrentSublistValue({
						    		sublistId: 'item',
						    		fieldId: LineField,	    		    		
						    		value: dNewDate
						    	});
								currentRecord.commitLine({
									sublistId: 'item'
								});
							}
						}
					}
				}
			}
//			}
		
//			dialog.alert ({
//				title : 'UpdateLineDatesWithHeaderDates iChannel=' + iChannel,
//				message : 'name=' + name + ', dNewDate=' + dNewDate + ', orderStatus=' + orderStatus + ', iLineCount=' + iLineCount
//			});
		}
    	return true;
    }
    /**
     * Client Validate Line Function - Retail Dates
     * Old Script Name:
     * Old Function Name:
     * @param currentRecord, sublist = Item 
     * @returns
     */
    function SetRetailItemDates(currentRecord)
    {  	
		var custForm = currentRecord.getValue('customform');
		if (custForm === CONSTANT_SO_RETAIL_FORM || custForm === CONSTANT_SO_SPS_FORM) {
			var orderStatus = currentRecord.getText('orderstatus');			
			if (orderStatus === 'Pending Approval' || orderStatus === 'Pending Fulfillment') {				
				var dExpectedShip = currentRecord.getValue('custbody_nswmspoexpshipdate');
				// Criteria 4: Header dates are not blank					
				if (dExpectedShip) {
					currentRecord.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'expectedshipdate',
						value: dExpectedShip,
						ignoreFieldChange: false,
			            fireSlavingSync: false
					});
				}
				// Update #2: Request Date
				var dRequested = currentRecord.getValue('custbody_nls_request_date');
				if (dRequested) {
					currentRecord.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'custcol_nls_request_date',
						value: dRequested
					});
				}
				// Update #3: Cancel Date
				var dCancel = currentRecord.getValue('custbody_nls_canceldate');
				if (dCancel) {
					currentRecord.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'custcol_nls_cancel_date',
						value: dCancel
					});
				}
			}
//			dialog.alert ({
//				title : 'SetRetailItemDates orderStatus=' + orderStatus,
//				message : 'curLineIndex=' + curLineIndex + ', dRequested=' + dRequested + ', dCancel=' + dCancel + ', custForm=' + custForm + ', curLineIndex=' + curLineIndex + ', iLineCount=' + iLineCount
//			});
		}

    	return true;
    }
    /**
     * Client Validate Line Function - Set Static Line Number
     * Old Script Name:
     * Old Function Name:
     * @param currentRecord
     * @param iMaxNum
     * @returns
     */
    function SetSOItemLineNumber(currentRecord, iMaxNum)
    {
		var curLineNumber = currentRecord.getCurrentSublistValue({
			sublistId: 'item',
			fieldId: 'custcol_nls_line_number'
		});
		var iLineCount = currentRecord.getLineCount('item');
		var NewLineNumber = 1;
		
		if (!curLineNumber || curLineNumber == '') {
			curLineNumber = 0;
		}
		if (!iLineCount || iLineCount == '') {
			iLineCount = 0;
		}

		var curLineIndex = currentRecord.getCurrentSublistIndex('item');
		
		// Get the current largest Line Number
		for (var iLine = 0; iLine < iLineCount; iLine++) {
			var iCurNum = currentRecord.getSublistValue({
				sublistId: 'item',
				fieldId: 'custcol_nls_line_number',
				line: iLine
			});
			if (iCurNum > iMaxNum) {
				iMaxNum = parseInt(iCurNum);
			}
		}
//		dialog.alert ({
//			title : 'SetSOItemLineNumber 0',
//			message : 'NewLineNumber=' + NewLineNumber + ', curLineNumber=' + curLineNumber + ', curLineIndex=' + curLineIndex + ', iMaxNum=' + iMaxNum + ', iLineCount=' + iLineCount
//		});

		// Different Item buttons: Add, Done, Make Copy, Copy Previous, Insert, Remove
		if (curLineIndex === 0) {
			NewLineNumber = 1;
		} 
		else if (iLineCount == 0 && curLineNumber == 1) 
		{ //1. VERY first line				
			NewLineNumber = 1;
			iMaxNum = 1;
		}
//		else if (iLineCount > 0 && curLineNumber < curLineIndex && curLineIndex > iMaxNum)
		else if (iLineCount > 0 && curLineNumber == 1 && iLineCount >= curLineIndex) 
		{
			//2. Add after Remove, Done after Insert				
			NewLineNumber = curLineIndex + 1;
		}
		else 
		{
			//3. Editing existing line
			NewLineNumber = curLineNumber;
			// Adding new line After item removed
			if (curLineNumber == 1 && curLineIndex != 1 && iMaxNum >= iLineCount){
				NewLineNumber = iMaxNum + 1;
			}
		}

		if (NewLineNumber != curLineNumber) {
			currentRecord.setCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'custcol_nls_line_number',
				value: NewLineNumber
			});
		}	
//		dialog.alert ({
//			title : 'SetSOItemLineNumber Final',
//			message : 'NewLineNumber=' + NewLineNumber + ', curLineNumber=' + curLineNumber + ', curLineIndex=' + curLineIndex + ', iMaxNum=' + iMaxNum + ', iLineCount=' + iLineCount
//		});

    	return true;
    }
    /**
     * Client Validate Delete Function - Item Count Down Project
     * Old Script Name:
     * Old Function Name:
     * @param currentRecord
     * @returns
     */
    function RemovedItemCountUp(currentRecord)
    {    	
		var sub_channel =  currentRecord.getValue('custbody_nls_subchannel');
		var doNotSubmitOrder = currentRecord.getValue('custbody_nls_do_not_submit_order');
		var sSOID = currentRecord.getValue('tranid');
		var itemType = currentRecord.getCurrentSublistValue({
			sublistId: 'item',
			fieldId: 'itemtype'
		});    		
		
		//*** User Interface, Call Center, Closed, DoNotSubmitOrder=F ***
		//*** doNotSubmitOrder is 'T' at Client side Validate Delete Function: removing - doNotSubmitOrder == 'F'    		
		if (sub_channel === SUB_CHANNEL_CALL_CENTER && (itemType === 'InvtPart' || itemType === 'Kit')) {
//			dialog.alert({
//				title: 'RemovedItemCountUp',
//				message: 'sub_channel=' + sub_channel + ', sSOID=' + sSOID + ', itemType=' + itemType + ', doNotSubmitOrder=' + doNotSubmitOrder
//			});

			var iQty = parseInt(currentRecord.getCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'quantity'
			}));

			var iItemCounted = parseInt(currentRecord.getCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'custcol_nls_icd_counted'
			}));

			var bFulfillable = currentRecord.getCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'custcol_nls_item_fulfillable'
			});

			var sItem = currentRecord.getCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'item'
			});

			var isClosed = currentRecord.getCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'isclosed'
			});
			// For In-flight order line.
			if (!iItemCounted || iItemCounted == 'NaN'){
				iItemCounted = 0;
			}
		
			//*** Increment item counter
			//1. Only if item is not Closed and Fulfillable
			if (bFulfillable === true && isClosed === false) {
				//2. ONLY if the item has been Counted: iQty == iItemCounted
				var bAdd = true;
				if (sItem && iQty > 0 && iQty == iItemCounted) {
					var oGone = [];
					oGone.sItem = sItem;
					oGone.iQty = iQty;
					if (g_arrDeleteItems) {
						for (var i = 0; i < g_arrDeleteItems.length; i++) {
							var sku = g_arrDeleteItems[i].sItem;
							if (sku == sItem) {
								bAdd = false;
								break;
							}
						}
					}
					if (bAdd == true) {
						g_arrDeleteItems.push(oGone);
					}
				}
			}
		}

    	return true;
    }
    /**
     * Client Save Record Function - Item Count Down Project
     * Old Script Name: 
     * Old Function Name:
     * @param currentRecord - global Array: g_arrDeleteItems
     * @returns
     */
    function IncrementItemCounter(currentRecord){
    	if (g_arrDeleteItems && g_arrDeleteItems.length > 0) {
    		var subsidiary = currentRecord.getValue('subsidiary');
    		var sub_channel = currentRecord.getValue('custbody_nls_subchannel');
    		var doNotSubmitOrder = currentRecord.getValue('custbody_nls_do_not_submit_order');
    		var sSOID = currentRecord.getValue('tranid');
    		
    		//*** SubChannel = Call Center, Closed, DoNotSubmitOrder=F ***		
    		if (sub_channel === SUB_CHANNEL_CALL_CENTER) {
    			//*** Only for Deleted Items ***
    			for (var iD = 0; iD < g_arrDeleteItems.length; iD++){
    				var sItem = g_arrDeleteItems[iD].sItem;
    				var strQTY = g_arrDeleteItems[iD].iQty;
    				var iQTY = 0;
    				if (strQTY){
    					iQTY = lib.forceParseInt(strQTY);
    				}
    				var arrResult = lib.SearchOneItemCountDown(subsidiary, sub_channel, sItem);    				
    				
    				if (arrResult && arrResult.id){
    					dialog.alert({
        	    			title: 'IncrementItemCounter arrResult=' + arrResult,
        	    			message: 'sub_channel=' + sub_channel + ', sSOID=' + sSOID + ', theItem=' + theItem + ', sItem=' + sItem + ', iQTY=' + iQTY + ', arrResult0.id=' + arrResult.id
        	    		});
    					var iID = arrResult.id;					
    					var theItem = arrResult.getValue('custrecord_nls_icd_item');
    					
    					if (theItem === sItem) {
    						//parseInt(arrResult.getValue('custrecord_nls_icd_start_qty'));
    						var sQty = arrResult.getValue('custrecord_nls_icd_start_qty');
    						var icdQty = 0;
    						if (sQty){
    							icdQty = lib.forceParseInt(sQty);
    						}
    						
    						icdQty += iQTY;
    						var idCounter = record.submitFields({
    						    type: 'customrecord_nls_item_count_down',
    						    id: iID,
    						    values: {
    						    	custrecord_nls_icd_start_qty: icdQty,
    						    	custrecord_nls_icd_lastso: sSOID
    						    },
    						    options: {
    						        enableSourcing: false,
    						        ignoreMandatoryFields : true
    						    }
    						});
    					}
    				}
    			}
    		}
    		g_arrDeleteItems.length = 0;
    	}
    	return true;
    }
	/**
	 * Page Init && Field Changed - Retail Store Project
	 * Old Script Name: NLS Retail Store & Retail Region Loc
	 * Old Function Name: DefaultHeaderFields
	 * @param currentRecord
	 * @param modeField - context Mode or Field ID
	 * @returns
	 */
    function SetRetailStoreHeaderFields(currentRecord, modeField)
    {
		if (modeField === 'create' || modeField === 'entity' || modeField === 'customform') {
			var oStatus = currentRecord.getText('orderstatus');
//			dialog.alert ({
//				title : "SetRetailStoreHeaderFields",					
//				message : "modeField=" + modeField + ', oStatus=' + oStatus + ', form: ' + currentRecord.getValue('customform')
//			});
			//1. Channel (custbody_nls_channel) = Retail
			currentRecord.setValue({
				fieldId: 'custbody_nls_channel',
				value: CONSTANT_CHANNEL_RETAIL
			});
			
			//2. Subsidiary (subsidiary) = Nautilus, Inc.
//				nlapiSetFieldValue('subsidiary', 1, false);
			currentRecord.setValue({
				fieldId: 'subsidiary',
				value: CONSTANT_SUBSIDIARY_US
			});
			//3. Department (department) = Retail Revenue and COGS
//				nlapisetValue('department', 85, false);
			currentRecord.setValue({
				fieldId: 'department',
				value: '85'
			});
			//4. Customer Category/ Sub-Channel (custbody_nls_sub_channel) = Retail Store
//				nlapiSetFieldValue('custbody_nls_sub_channel', 67, false);
			currentRecord.setValue({
				fieldId: 'custbody_nls_sub_channel',
				value: '67'
			});
			
			// Custom List: Sub-Channel 
//				nlapiSetFieldValue('custbody_nls_subchannel', 4, false);
			currentRecord.setValue({
				fieldId: 'custbody_nls_subchannel',
				value: '4'
			});
			//??? Header price level???
//				nlapiSetFieldValue('pricelevel', PRICE_LEVEL_RETAIL_STORE, false);
			currentRecord.setValue({
				fieldId: 'pricelevel',
				value: PRICE_LEVEL_RETAIL_STORE
			});
			//??? Header Location ???
//				nlapiSetFieldValue('location', LOCATION_RETAIL_STORE, false);
			currentRecord.setValue({
				fieldId: 'location',
				value: LOCATION_RETAIL_STORE
			});
			// Origin
//				nlapiSetFieldValue('custbody_nls_origin', ORIGIN_RETAIL_STORE, false);
			currentRecord.setValue({
				fieldId: 'custbody_nls_origin',
				value: ORIGIN_RETAIL_STORE
			});

			if (oStatus === STATUS_PENDINGAPPROVAL || !oStatus) {
//					nlapiSetFieldValue('orderstatus', STATUS_PENDINGFULFILL, false);
				currentRecord.setValue({
					fieldId: 'orderstatus',
					value: 'B'
				});
			}		
		}

    	return true;
    }
    /**
     * Client Post Sourcing - Retail Store Project
     * Old Script Name: NLS Retail Store & Retail Region Loc
     * Old Function Name: DefaultFields_postSourcing
     * @param currentRecord
     * @param sublist
     * @param modeField - Context Mode or Field ID
     * @returns
     */
    function SetRetailStoreFields(currentRecord, sublist, modeField){
//    	dialog.alert ({
//			title : "SetRetailStoreFields",					
//			message : "sublist=" + sublist + ', modeField=' + modeField + ', form: ' + currentRecord.getValue('customform')
//		});
    	SetRetailStoreHeaderFields(currentRecord, modeField);
    	SetRetailStoreLineFields(currentRecord, sublist, modeField);	
    }
    /**
     * Client Post Sourcing Line Item - Retail Store Project
     * Old Script Name: NLS Retail Store & Retail Region Loc
     * Old Function Name: DefaultLineFields
     * @param currentRecord
     * @param sublist = Item
     * @param fieldID = Item
     * @returns
     */
    function SetRetailStoreLineFields(currentRecord, sublist, fieldID)
    {	    	
    	if (sublist === 'item' && fieldID === 'item'){
//    		dialog.alert ({
//    			title : "SetRetailStoreLineFields",					
//    			message : "sublist=" + sublist + ', fieldID=' + fieldID + ', form: ' + currentRecord.getValue('customform')
//    		});
			//1. Price Level: Retail Store 86 ???
//    		nlapiSetCurrentLineItemValue('item','price', PRICE_LEVEL_RETAIL_STORE, false);
			currentRecord.setCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'price',
				value: PRICE_LEVEL_RETAIL_STORE
			});
			//2. Shipment #			
//    		nlapiSetCurrentLineItemValue('item', 'custcol_nswms_shipment_no', 'Retail Store', false);
			currentRecord.setCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'custcol_nswms_shipment_no',
				value: "Retail Store"
			});

			//3. Locations: 
			// DC waved: US DC Portland: Channel - Retail (ID=21)			
//    		var iLoc = nlapiGetCurrentLineItemValue('item','location');    			
			var iLoc = currentRecord.getCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'location'
			});
			if (!iLoc || iLoc == '') {
//    				nlapiSetCurrentLineItemValue('item', 'location', LOCATION_RETAIL_STORE, false);
				currentRecord.setCurrentSublistValue({
    				sublistId: 'item',
    				fieldId: 'location',
    				value: LOCATION_RETAIL_STORE
    			});
			}
			//5. Location Override	(ID=custcol_nls_location_override)			
//    		nlapiSetCurrentLineItemValue('item','custcol_nls_location_override', 'T', false);	
			currentRecord.setCurrentSublistValue({
				sublistId: 'item',
				fieldId: 'custcol_nls_location_override',
				value: true
			});
    	}	
    	return true;
    }
    /**
     * Client Save Record Function - Retail Store Project
     * Old Script Name: NLS Retail Store & Retail Region Loc
     * Old Function Name: Save_Approve
     * @param currentRecord
     * @returns - Auto Approve Sales Order
     */
    function ApproveRetailStoreSO(currentRecord) {
    	var oStatus = currentRecord.getText('orderstatus');
//    	nlapiSetFieldValue('custbody_nls_execute_save_submit', 'T');	
		currentRecord.setValue({
			fieldId: 'custbody_nls_execute_save_submit',
			value: true
		});
//    	nlapiSetFieldValue('custbody_nls_do_not_submit_order', 'T');
		currentRecord.setValue({
			fieldId: 'custbody_nls_do_not_submit_order',
			value: true
		});
		
		if (oStatus === STATUS_PENDINGAPPROVAL){
//    		nlapiSetFieldValue('orderstatus', STATUS_PENDINGFULFILL, true, true);
			currentRecord.setValue({
    			fieldId: 'orderstatus',
    			value: 'B'
    		});
		}

    	return true;
    }
    /**
     * Client - Save Record Function
     * @param currentRecord
     * @returns
     */
    function SetOrderSettleComplete(currentRecord){
		// Check Finance Partners: custbody_nls_financing_company
		var sFinancingCo = currentRecord.getValue('custbody_nls_financing_company');
		var sPaymentMethod = currentRecord.getValue('paymentmethod');
		var sNLSPayMethod = currentRecord.getValue('custbody_nls_payment_method');
//		var oldShipComplete = currentRecord.getValue('shipcomplete');
//		//*** Progressive Leasing Changes in QualifyShipComplete
//		var bShipComplete = lib.QualifyShipComplete(sPaymentMethod, sNLSPayMethod, sFinancingCo);
//		// Update ship complete ONLY when different
//
//		if (bShipComplete != oldShipComplete){
//			currentRecord.setValue({
//				fieldId: 'shipcomplete',
//				value: bShipComplete
//			});
//		}
		 // DF-9521 Direct Orders should settle complete based on payment method or finance partner
		 // Settle Complete: custbody_nls_settle_complete
		var oldSettleComplete = currentRecord.getValue('custbody_nls_settle_complete');		
		var bSettleComplete = lib.QualifySettleComplete(sPaymentMethod, sNLSPayMethod, sFinancingCo);
		
//		alert('bSettleComplete=' + bSettleComplete + ', oldSettleComplete=' + oldSettleComplete);
		
		currentRecord.setValue({
			fieldId: 'custbody_nls_settle_complete',
			value: bSettleComplete
		});

		return true;
    }
    
    function RequestOrderStatus_ProgLeasing(curRecord){
    	var bOK = true;
    	var plID;
    	var sAcctNum = '5097773';
    	var sEnv = runtime.envType;
    	var sURL = nls_ws.GetProgressiveLeasingURL(sEnv);
//    	alert('sURL=' + sURL + ", sEnv=" + sEnv);
    	var strRequestBody = nls_ws.PL_RequestStatusWithDeliveryConfirmation(sEnv, sAcctNum);
//    	alert('strRequestBody=' + strRequestBody);
    	var Header = {
    		SOAPAction: "RequestStatusWithDeliveryConfirmation"
    	};
    	var oResponse = https.post({
			url: sURL,
			body: strRequestBody,
			headers: Header
		});
    	
		var respBody = oResponse.body;
		var headers = oResponse.headers;
		var respCode = oResponse.code;		
		
		var respReqOrderStatus = nls_ws.PL_ProcessRespStatusWithDeliveryConfirmation(respBody);
		if (respCode === 500){
//			objOrderDeliveryStatusResponse.errorNumber = str_Error;
//			objOrderDeliveryStatusResponse.errorDescription = FaultNode[1].firstChild.textContent;
			alert("Error! " + respReqOrderStatus.replyMsg + '\n' + "FaultCode=" + respReqOrderStatus.errorNumber + " \nFaultMsg=" + respReqOrderStatus.errorDescription);			
			bOK = false;
		} else {		
			alert("SUCCESS replyMsg=" + respReqOrderStatus.replyMsg);
	//		if (respReqOrderStatus.status === 'Approved') {
//				curRecord.setValue({
//					fieldId: 'custbody_nls_created_from',
//					value: respReqOrderStatus.eSignURL
//				});
//				//custbody_ebiz_ord_size
//				curRecord.setValue({
//					fieldId: 'custbody_ebiz_ord_size',
//					value: respReqOrderStatus.bDeliverOK
//				});
				alert('Order Status from Progressive Leasing with URL=' + respReqOrderStatus.eSignURL + '\n' + ", bDeliverOK=" + respReqOrderStatus.bDeliverOK + ", Status=" + respReqOrderStatus.status);			
	//		}
		}
    	return bOK;
    }
    /**
     * Call Finance.GetApprovedApplication and create/Update Progressive Leasing Record
     * Search Progressive Leasing By idCustomer
     * @param curRecord
     * @param sMerchandise
     * @returns
     */
    function GetApprovedAcctID_ProgLeasing(curRecord, objLeasing){
    	var bOK = false;
    	var plID;
    	// Order Header    		
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
    	if (sEntityID){
    		bOK = true;
    	}
    	var sAcctNum = curRecord.getValue('custbody_nls_pl_contract_number');
    	var creditLine = curRecord.getValue('custbody_nls_pl_credit_line');
    	var sEsignURL = curRecord.getValue('custbody_nls_pl_esign_url');    	
//    	if (sAcctNum || creditLine){    		
//        	alert('The order already has an approved Progressive Leasing Contract #' + sAcctNum + ", Credit Line=" + creditLine);
//        	bOK = false;
//    	}
    	if (sEsignURL) {
    		alert("eSign URL already created and sent for the order approved Leasing Contract #:" + sAcctNum);
    		bOK = false;
    	}
    	if (bOK){
    		var sEnv = runtime.envType;
    		sURL = nls_ws.GetNLSRouterURL(sEnv);
			
			// Build Router Financing request XML: Credential + Action + FinanceCompany
    		var sInData = '<SourceSystem>OM</SourceSystem><FinanceCompany>PROGRESSIVE</FinanceCompany>';
	    	sInData += '<CustomerID></CustomerID>';
	    	
			var strRequestBody = nls_ws.BuildFinanceRequestXML(sEnv, 'GetApprovedApplications', sInData);
			//*** HARD CODED ***
//			sEntityID = 'CUS-170195414';
//			sEntityID = 'CUS-050117';
			
			strRequestBody = nls_ws.setRequestNodeValue(strRequestBody, 'Request/Data/CustomerID', sEntityID);
			
//			alert("Retrieving customer Leasing Applications from NLS Financing... \n" + "Entity ID=" + sEntityID + ", Environment=" + sEnv);
//			alert('strRequestBody=' + strRequestBody);
			
			// *** Call NLS Financing Router
			var oResponse = https.post({
				url: sURL,
				body: strRequestBody
			});

			var body = oResponse.body;
			var headers = oResponse.headers;
			var output = oResponse.code;
			
			// *** Response Body from NLS Financing Router
			var respApplicationResponse = nls_ws.GetApproveID_ProgLeaseResp(body);
			
			var objWS = new Object();			
			objWS.status = respApplicationResponse.status;
			objWS.requestXML = strRequestBody;			
//	    	alert('Response=' + body);
			
	    	if (respApplicationResponse && respApplicationResponse.status === 'Success') {
				var arrApplications = respApplicationResponse.arrApprovals;
				// Customer has approved contract
				var bHasContract = false;
				// Update or Create
				var bCreateNewPL = false;
				if (arrApplications && arrApplications.length > 0) {
					objWS.responseXML = respApplicationResponse.sTagValue
					// Loop Through PL Applications
//					alert("Status=" + respApplicationResponse.status + ', sTagValue=' + respApplicationResponse.sTagValue + " Found " + arrApplications.length + " approved Leasing Contract!");
					bHasContract = true;
				} else if (respApplicationResponse.sAccountNumber) {
					bHasContract = true;
//					alert("Progressive Leasing Contract retrieved successfully!\n Application ID=" + respApplicationResponse.sApplicationID
//					+ "\n Account Number=" + respApplicationResponse.sAccountNumber + "\n Credit Limit=" + respApplicationResponse.fCreditLine);
					var plAcctNum = respApplicationResponse.sAccountNumber;
					var resultPLAcctNum = lib_pl.SearchProgLeasingByAccountNum(plAcctNum);
					
					if (resultPLAcctNum && resultPLAcctNum.count > 0){
						var foundCust = resultPLAcctNum.result.getValue('custrecord_nls_pl_customer');
						var foundEntityID = resultPLAcctNum.result.getValue('custrecord_nls_pl_entity_id');
						var foundSO = resultPLAcctNum.result.getValue('custrecord_nls_pl_sales_order');
						var foundSOID = resultPLAcctNum.result.getValue('custrecord_nls_pl_order_id');
						var plCount = resultPLAcctNum.count;
//						alert("Found plAcctNum=" + plAcctNum + ", plCount=" + plCount + ", resultPLAcctNum.result.id=" + resultPLAcctNum.result.id + ", foundCust=" + foundCust + ", foundEntityID=" + foundEntityID + ", foundSO=" + foundSO + ", foundSOID=" + foundSOID);
						
						if (foundEntityID && sEntityID === foundEntityID) {
							var curTranID = curRecord.getValue('tranid');
							if (foundSOID && curTranID && curTranID != foundSOID){
								alert("ERROR! Progressive Lease ID: " + plAcctNum + " already used for " + foundSOID + ", id=" + foundSO + " Entity ID=" + foundEntityID);	
							} else {
								// Update plID when no linked sales order
								if (plCount == 1 && !foundSO){
									plID = resultPLAcctNum.result.id;
								} else {
									if (foundSO === curRecord.id){
										plID = resultPLAcctNum.result.id;
									} else {
										alert("Multi Orders ERROR! Progressive Lease ID: " + plAcctNum + " is used for " + plCount + " orders for customer ID=" + foundEntityID);
									}
								}
							}
						} else {
							// Wrong Customer !!!
							bHasContract = false;
							alert("ERROR! Lease ID has been used for another customer on file - Entity ID = " + foundEntityID + ", Lease ID=" + plAcctNum);							
						}
					} else {
						bCreateNewPL = true;
					}
				} else {
					alert("Cannot find any Approved Progressive Leasing Contract for customer " + sEntityID);
				}
				
				if (bHasContract){
					// Search new customer contract					
//					var objPL = lib_pl.SearchProgLeaseApplByCustNoOrder(idCustomer);
					if (bCreateNewPL){
						plID = lib_pl.CreateProgLeasingRecord(respApplicationResponse, sEntityID, idCustomer);
					} else {	
						objWS.status = respApplicationResponse.status;
						if (plID){
							alert("Updating PL record for Customer ID=" + sEntityID + ", plID=" + plID + ", Lease ID=" + plAcctNum);
							bOK = lib_pl.UpdateProgressiveLeasingOrder(plID, curRecord, objLeasing, objWS);
						}
					}
					
					// Update Sales order:
					if (plID){
						// P Leasing Contract number					
						if (respApplicationResponse.sAccountNumber){
							curRecord.setValue({
								fieldId: 'custbody_nls_pl_contract_number',
								value: respApplicationResponse.sAccountNumber
							});
						}
						// P Leasing Credit Line: custbody_nls_pl_credit_line
						if (respApplicationResponse.fCreditLine){
							curRecord.setValue({
								fieldId: 'custbody_nls_pl_credit_line',
								value: respApplicationResponse.fCreditLine
							});
						}
					}
				}
			}
			else {				
				objWS.errorMessage = respApplicationResponse.errorSource;
	    		objWS.ErrorCode = respApplicationResponse.errorNumber;	    		
	    		bOK = lib_pl.UpdateProgressiveLeasingOrder(plID, curRecord, objLeasing, objWS);

				alert(respApplicationResponse.status + "  Unable to retrieve Progressive Leasing Acct Number.  Error #: " + respApplicationResponse.errorNumber + ", Error Source= " + respApplicationResponse.errorSource
						+ ", Error Description=" + respApplicationResponse.errorDescription);				
			}
    	} 
    	return plID;
    }
    
    function SubmitInvoiceInfoToPL(currentRecord, objLeasing){
    	// Field Changed: Checkbox "Submit Progressive Leasing Invoice" 
    	var bOK = false;
    	var plAcctNum = currentRecord.getValue('custbody_nls_pl_contract_number');		
		var creditLimit = currentRecord.getValue('custbody_nls_pl_credit_line');
		var hasEsignURL = currentRecord.getValue('custbody_nls_pl_esign_url');
		// DF-11971 eSign URL validation
		if (hasEsignURL){
			var sError = "Please remove eSign URL to send a new contract to customer";
			alert(sError);
		} else if (plAcctNum && objLeasing.sMerchandise && creditLimit){
			bOK = true;
		} else {
			var sError = "CANNOT Submit Invoice Info To Progressive Leasing! \n";
			if (!objLeasing.sMerchandise) {
				sError += "No Merchandise Item found!";
			} else {
				sError += "Lease ID=" + plAcctNum + ", Credit Limit=" + creditLimit;
			}
			alert(sError);
		}
		
    	if (bOK){
    		var yesSubmitOrder = bOK;
    		var plID;   			
			var idCustomer = currentRecord.getValue('entity');
			// *** Search by Customer Id and Account Number where eSignURL is empty ***
//			var objPL = lib_pl.SearchProgLeasingByCustAcct(idCustomer, plAcctNum);

			// Search the account Number for duplicate?
			var foundAcctNum = lib_pl.SearchProgLeasingByAccountNum(plAcctNum);
			if (foundAcctNum && foundAcctNum.count > 0){
				var foundCust = foundAcctNum.result.getValue('custrecord_nls_pl_customer');
				var foundEntityID = foundAcctNum.result.getValue('custrecord_nls_pl_entity_id');									
				
				if (foundCust && idCustomer === foundCust){
//					alert("Found Account Number: " + plAcctNum + " Customer=" + foundEntityID + ", id=" + foundCust + ", foundAcctNum.result.id=" + foundAcctNum.result.id);
					var curTranID = currentRecord.getValue('tranid');
					var foundSO = foundAcctNum.result.getValue('custrecord_nls_pl_sales_order');
					var foundSOID = foundAcctNum.result.getValue('custrecord_nls_pl_order_id');	
					
					if (foundSOID && curTranID && curTranID != foundSOID){
						// Already used by another SO
						yesSubmitOrder = false;
						alert("ERROR! Progressive Lease ID: " + plAcctNum + " already used for " + foundSOID + ", id=" + foundSO + " Entity ID=" + foundEntityID + ", curTranID=" + curTranID);	
					} else {
						// Update plID
						if (!foundSO){
							plID = foundAcctNum.result.id;
						} else {
							if (foundSO === currentRecord.id){
								plID = foundAcctNum.result.id;
							} else {
								yesSubmitOrder = false;
								var foundURL = foundAcctNum.result.getValue('custrecord_nls_pl_esign_url');
								alert("ERROR! Unable to update PL record - Progressive Lease ID: " + plAcctNum + " foundSOID=" + foundSOID);
							}
						}
					}
				} else {
					// Different Customer !!!					
					yesSubmitOrder = false;
					alert("ERROR! Lease ID has been used for another customer on file - Entity ID = " + foundEntityID + ", found Cust id=" + foundCust + ", Lease ID=" + plAcctNum);							
				}
			} else {
				// Account Number Not found - Create a new PL record with the order
				var objLookupEntityID = search.lookupFields({
	        		type: search.Type.CUSTOMER,
	        		id: idCustomer,
	        		columns: ['entityid']
	        	});
				var sEntityID;
		    	if (objLookupEntityID){
		    		sEntityID = objLookupEntityID.entityid;
		    		plID = lib_pl.CreateProgressiveLeasingWebOrder(currentRecord, sEntityID, idCustomer, objLeasing);    
		    		alert("New Progressive Leasing Contract Created for sEntityID=" + sEntityID + ", Lease ID=" + plAcctNum + ", New PL Id=" + plID);
		    	}
			}		


    		if (plID && yesSubmitOrder){
//    			if (objLeasing.bOK && objLeasing.bLeasing && objLeasing.bSubmitOrder){	            				
    				// *** ALERT MESSAGE ***	            	    		
            	var sLeaseMsg = "You have selected Progressive Leasing." + " \n"	    			
    			+ "1. Checking Qualified Bill To State... " + '\n'
    			+ "2. Checking Qualified Ship To State... " + '\n'
    			+ "3. Checking Qualified Order Items... " + '\n'
    			+ "4. Validating Mode of Transfort... " + '\n'            			
    			+ "5. Recalculating shipping charges... " + '\n'
    			+ "6. Recalculating Tax and Order Total... " + '\n'
    			+ "7. Validating Credit Line... " + '\n'
    			+ "8. Changing Ship Complete... " + '\n'
    			+ "9. Changing Entity/Use Code... " + '\n'
    			+ "10. Submiting Leasing Application... "            				
    			
//    			alert(sLeaseMsg);
            	// *** ALERT MESSAGE ***				
				// Search Progressive Leasing By Acct # and Order #
				var idSO = currentRecord.id;
            	var sError = "Cannot submit order to Progressive Leasing for Lease ID=" + plAcctNum + " \n";
            	
				if (idSO){
					// Search by Account number and sales order ID where "OK to Deliver" is NOT true
					var objResult = lib_pl.SearchProgLeasingReSubmitOrder(plAcctNum, idSO);
					if (objResult && objResult.count > 0){
						
						if (objResult.count > 1){
							alert(sError + "Found " + objResult.count + " Progressive Leasing Contracts for this order!");
						} else if (objResult.count === 1){
							//*** DF-11971 eSign URL validation DO NOT CHECK eSignURL on custom record.
							// Check eSignURL
//							var sURL = objResult.result.getValue('custrecord_nls_pl_esign_url');
//							if (sURL){
//								alert(sError + "Found " + objResult.count + " Progressive Leasing Contract for this order with eSignURL sent to customer.  Remove the eSignURL to resubmit the order: \n" + sURL);
//							} else {
								SubmitOrderInfo_ProgLeasing(currentRecord, objLeasing, plID);
//							}
						}
					} else {
						SubmitOrderInfo_ProgLeasing(currentRecord, objLeasing, plID);
					}
				} else {
					alert(sError + "Please Save the order before sending to Progressive Leasing");
				}
    		}
    	}
    	return true;
    }
    
    function SubmitOrderInfo_ProgLeasing(curRecord, objLeasing, idPL){
    	var bOK = true;
    	var sCustID = curRecord.getText('entity');
    	var sAcctNum = curRecord.getValue('custbody_nls_pl_contract_number');
    	var sEsignURL = curRecord.getValue('custbody_nls_pl_esign_url');    	
    	var fCreditLimit = curRecord.getValue('custbody_nls_pl_credit_line');    	
    	var sOrderID = curRecord.getValue('tranid');    	
    	var iPLItemCount = curRecord.getLineCount('item');
    	
    	if (!sAcctNum || !sCustID || !fCreditLimit) {
    		bOK = false;
    		alert("Invalid Lease ID=" + sAcctNum + ', Cust ID=' + sCustID + ", Credit Limit=" + fCreditLimit + ', sOrderID=' + sOrderID + ", iPLItemCount=" + iPLItemCount);
    	} 
    	
//    	if (bOK && sOrderID && iPLItemCount > 0 && !sEsignURL){
    	if (bOK) {
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
			
//			alert('strRequestBody=' + strRequestBody);
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
						// DF-11934 Store error message on SO if eSign URL is not returned at Save and Submit
						curRecord.setValue({
							fieldId: 'custbody_nls_pl_esign_url',
							value: sNewEsignURL
						});
						// Clear Error MSG
						curRecord.setValue({
							fieldId: 'custbody_nls_pl_so_error_msg',
							value: ''
						});
					
						bOK = lib_pl.UpdateProgressiveLeasingSubmitOrder(idPL, curRecord, objLeasing, objWS, today);
						
						alert('Order submitted to Progressive Leasing successfully with URL: \n' + respSubmitOrderInfo.eSignURL);
					}
				}
				else {
					objWS.errorMessage = respSubmitOrderInfo.errorSource;
		    		objWS.ErrorCode = respSubmitOrderInfo.errorNumber;
		    		
					bOK = lib_pl.UpdateProgressiveLeasingOrder(idPL, curRecord, objLeasing, objWS);
					alert(respSubmitOrderInfo.status + "!  Unable to submit order to Progressive Leasing idPL=" + idPL + '\n' + respSubmitOrderInfo.errorSource);					
				}
			} else {
				alert("PL_NLS_ROUTER_ERROR - SubmitOrderInfo_ProgLeasing");
			}
    	}
    	return bOK;
    }
    
    return {
        pageInit: NLS_PageInit,
        fieldChanged: NLS_FieldChanged,
        postSourcing: NLS_PostSourcing,
//        sublistChanged: sublistChanged,
//        lineInit: lineInit,
//        validateField: NLS_validateField,
        validateLine: NLS_ValidateLine,
//        validateInsert: validateInsert,
        validateDelete: NLS_ValidateDelete,
        saveRecord: NLS_SaveRecord
    };
    
});
