/**
 * Function for Client Script on Sales Order
 * Created By: KCHANG *  
 * DF-12051 Retail order is not getting location assigned on a customer that is not set up for retail region logic
 * Last Modified: 8/4/2017
 * DF-9521 Direct Orders should settle complete based on payment method or finance partner
 * Last Modified: 9/13/2017
 */
define(['N/record', 'N/search', 'N/error'],
		
function(record, search, error) {
	var CONSTANT_SUBSIDIARY_US = '1';
	var CONSTANT_SUBSIDIARY_CA = '2';
	// Progressive Leasing 
	// Payment Method List (Custom):  Production = 110
	var NLS_PAY_TYPE_LEASING = '109';
	// Accounting List: Payment Method = 27
	var NS_PAY_METHOD_LEASING = '27';
	
	function SearchCustomerAddrID(custID, shipAddr){
    	// Search Customer Address Zip Code by ship addresss ID
//    	var shipTO = '';
		//address2 = rCustomer.getLineItemValue('addressbook', 'addr1', iAddr);
    	var addrDetails = new Object();
    	var arrAddresses = new Array();
    	if (custID && shipAddr){
	    	var customerSearchObj = search.create({
			   type: "customer",
			   filters: [
			      ["internalidnumber","equalto",custID]
			   ],
			   columns: [
				  "entityid",
				  "addressinternalid",				 
			      "address1",
			      "shipaddress1",
			      "shipstate",
			      "shipzip",
			      "shipcountry",
			      "shipaddress",
			      "state"
			   ]
			});
	    	arrAddresses = customerSearchObj.run().getRange({
	    		start: 0,
	    		end: 100
	    	});
	    	for (var iAddr = 0; iAddr < arrAddresses.length; iAddr++){
	    		var result = arrAddresses[iAddr];
	    		var sAddrId = result.getValue('addressinternalid');
	    		if (shipAddr === sAddrId) {
	    			addrDetails.addrId = sAddrId;
					addrDetails.shipAddress = result.getValue('shipaddress1');
					addrDetails.addr1 = result.getValue('address1');
					addrDetails.state = result.getValue('shipstate');
					addrDetails.zip = result.getValue('shipzip');
					addrDetails.iState = result.getValue('state');
					return addrDetails;
				}
	    	}

    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "SearchCustomerAddrID",
//                message: "Please enter required parameters before searching: [custID && shipAddr]"
//            });
    	}
    	return addrDetails;
//    	return arrAddresses;
    }
	
	function SearchRetailCustAddress(iCust, shipAddrId){
		var addrDetails = new Object();
    	var arrAddresses = new Array();
    	if (iCust && shipAddrId){
    		var retailCustSearchObj = search.create({
			   type: "customer",
			   filters: [
			      ["internalidnumber","equalto",iCust]
			   ],
			   columns: [
			      "entityid",			      
			      "entitynumber",
			      "internalid",
			      "billstate",
			      "billzipcode",
			      "shipzip",
			      search.createColumn({
			          name: "addressinternalid",
			          join: "Address",
			          sort: search.Sort.ASC
			      }),
			      search.createColumn({
			         name: "zipcode",
			         join: "Address"
			      }),
			      search.createColumn({
			         name: "state",
			         join: "Address"
			      }),
			      search.createColumn({
 			         name: "address1",
 			         join: "Address"
 			      }),
 			      search.createColumn({
 			         name: "address",
 			         join: "Address"
 			      })
			   ]
			});
			var searchResultCount = retailCustSearchObj.runPaged().count;		
			if (searchResultCount) {
				addrDetails.count = searchResultCount;
				if (searchResultCount > 1000) {
					var myPagedData = retailCustSearchObj.runPaged();
					myPagedData.pageRanges.forEach(function(pageRange){
		                var myPage = myPagedData.fetch({index: pageRange.index});
		                myPage.data.forEach(function(result){
		                	var sAddrId = result.getValue({
				    			name: 'addressinternalid',
				    			join: 'Address'
				    		});
		                	
		                	if (shipAddrId === sAddrId) {
				    			addrDetails.addrId = sAddrId;
								addrDetails.shipAddress = result.getValue({
									name: 'address',
									join: 'Address'
								});
								addrDetails.addr1 = result.getValue({
									name: 'address1',
									join: 'Address'
								});
								addrDetails.state = result.getValue({
									name: 'state',
									join: 'Address'
								});
								addrDetails.zip = result.getValue({
									name: 'zipcode',
									join: 'Address'
								});
								addrDetails.iState = result.getValue('billstate');
								addrDetails.shipzip = result.getValue('shipzip');
								if (addrDetails.zip || addrDetails.shipzip){
									return addrDetails;
								}
							}
		                });
		            });
				} else {
					var iEnd = 999;
					var iStart = 0;
					if (iEnd > searchResultCount){
						iEnd = searchResultCount - 1;
					}
					// *** DF-12051 Retail order is not getting location assigned on a customer that is not set up for retail region logic
					if (iEnd < iStart){
						iEnd = iStart;
					}
					// *** Incident #22931 CUS-17001334 Fremont Schwinn Cyclery - Oh - No Location on the line level
					arrAddresses = retailCustSearchObj.run().getRange({
			    		start: iStart,
			    		end: iEnd
			    	});					
					
					for (var iAddr = 0; iAddr < arrAddresses.length; iAddr++) {
			    		var result = arrAddresses[iAddr];
			    		var sAddrId = result.getValue({
			    			name: 'addressinternalid',
			    			join: 'Address'
			    		});
			    		if (shipAddrId === sAddrId) {
			    			addrDetails.addrId = sAddrId;
							addrDetails.shipAddress = result.getValue({
								name: 'address',
								join: 'Address'
							});
							addrDetails.addr1 = result.getValue({
								name: 'address1',
								join: 'Address'
							});
							addrDetails.state = result.getValue({
								name: 'state',
								join: 'Address'
							});
							addrDetails.zip = result.getValue({
								name: 'zipcode',
								join: 'Address'
							});
							addrDetails.iState = result.getValue('billstate');
							addrDetails.shipzip = result.getValue('shipzip');
							if (addrDetails.zip || addrDetails.shipzip){
								return addrDetails;
							}
						}
			    	}
				}
			}
    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "SearchRetailCustAddress",
//                message: "Please enter required parameters before searching: [iCust && shipAddrId]"
//            });
    	}
    	return addrDetails;
	}
	function SearchItemDCFields(idItem)
    {
    	var ItemSharedDC;
    	if (idItem){
	    	var itemSearchObj = search.create({
			   type: 'item',
			   filters: [
			      ["internalid","anyof", idItem]
			   ],
			   columns: [
			      "custitem_nls_shared_item",
			      "custitem_nls_portland_dc",
			      "custitem_nls_ohio_dc",
			      "custitem_nls_ca_drop_ship",
			      "custitem_nls_winnipeg_dc"
			   ]
			});
	    	var bShare;
	    	var bPortlandDC;
			itemSearchObj.run().each(function(result) {				
				bShare = result.getValue('custitem_nls_shared_item');
				bPortlandDC = result.getValue('custitem_nls_portland_dc');
				ItemSharedDC = result;
			});
//			dialog.alert ({
//				title : 'SearchItemDCFields',
//				message : 'ItemSharedDC=' + ItemSharedDC.getValue('custitem_nls_shared_item') + ', bShare=' + bShare + ', bPortlandDC=' + bPortlandDC
//			});
    	}
		return ItemSharedDC;
    }
    
    function SearchLocationConfig(itemID, sSubsidiary, channel, region, specialOrder, shared, dropShip){
    	// SearchLocationConfig(idItem, sSubsidiary, iChannel, iRegion, bSpecOrd, bShared, bDropShip);
    	// Item, Channel, sSubsidiary are Required fields    	    		
    	var oResult = new Object();
    	if (itemID && sSubsidiary && channel){
//    		dialog.alert ({
//    			title : 'SearchLocationConfig',
//    			message : 'itemID=' + itemID + ', channel=' + channel + ', sSubsidiary=' + sSubsidiary
//    		});
    		//new nlobjSearchFilter('custrecord_loc_config_distr_center', null, 'anyof', stLocConfigDistCntr),
	    	var searchLocationConfig = search.create({
			   type: "customrecord_location_config",
			   filters: [
			      ["custrecord_loc_config_sku","anyof",itemID], 
			      "AND", 
			      ["custrecord_loc_config_subsidiary","anyof", sSubsidiary], 
			      "AND", 
			      ["custrecord_loc_config_channel","anyof", channel],
			      "AND", 
			      ["custrecord_loc_config_region","anyof", region],
			      "AND", 
			      ["custrecord_loc_config_special_order","is", specialOrder],
			      "AND", 
			      ["custrecord_loc_config_drop_ship","is", dropShip],
			      "AND", 
			      ["custrecord_loc_config_shared","is", shared],
			      "AND",
			      ['isinactive', 'is', 'F']
			   ],
			   columns: [
			      "custrecord_loc_config_location",
			      "custrecord_loc_config_distr_center",
			      "custrecord_loc_config_sku"
			   ]
			});
	    	
//	    	searchLocationConfig.run().each(function(result){
//	    		objLoc.location = result.getValue('custrecord_loc_config_location');
//	    		objLoc.DC = result.getValue('custrecord_loc_config_distr_center');	    		
//			});
	    	oResult.count = searchLocationConfig.runPaged().count;
	    	searchLocationConfig.run().each(function(result){
			   // .run().each has a limit of 4,000 results
				oResult.result = result;
			});	
	    	
    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "SearchLocationConfig",
//                message: "Please enter required parameters before searching: [itemID, sSubsidiary, channel]"
//            });
    	}
//    	dialog.alert ({
//			title : 'SearchLocationConfig',
//			message : 'AFTER objLoc.location= ' + objLoc.location + ', objLoc.DC= ' + objLoc.DC
//		});
		return oResult;
    }
    /**
     * To replace Saved Search: SCRIPT USE | Location Config Distribution Groups
     * @param arrItems
     * @param sSubsidiary
     * @param channel
     * @returns Location ID = commLoc
     */
    function SearchCommonLocDC(arrItems, sSubsidiary, channel, region)
    {
    	// ** arrItems.length should be > 1
    	var commDC;
    	if (arrItems && sSubsidiary && channel) {    		
    		var searchCommonLocDC = search.create({
    		   type: "customrecord_location_config",
    		   filters: [
    			  ["custrecord_loc_config_sku","anyof",arrItems], 
 			      "AND",
 			     ["custrecord_loc_config_region","anyof", region],
			      "AND", 
    		      ["custrecord_loc_config_subsidiary","anyof", sSubsidiary], 
    		      "AND", 
    		      ["isinactive","is","F"], 
    		      "AND", 
    		      ["custrecord_loc_config_channel","anyof",channel]
    		   ],
    		   columns: [
    		      search.createColumn({
    		         name: "custrecord_loc_config_sku",
    		         summary: "COUNT"
    		      }),
    		      search.createColumn({
    		         name: "custrecord_loc_config_distr_center",
    		         summary: "GROUP"
    		      })
    		   ]
    		});
    		searchCommonLocDC.run().each(function(result){
    			var stCount = result.getValue({
    				name: 'custrecord_loc_config_sku', 
    				summary: 'COUNT'
    			});
    			
				if (stCount == arrItems.length) {
					commDC = result.getValue({
						name: 'custrecord_loc_config_distr_center',
						summary: 'GROUP'
					});					
				}
//				dialog.alert ({
//	    			title : 'SearchCommonLocDC',
//	    			message : 'commDC= ' + commDC + ', stCount=' + stCount + ', arrItems.length=' + arrItems.length
//	    		});
    		});
    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "SearchCommonLocDC",
//                message: "Please enter required parameters before searching: [arrItems, sSubsidiary, channel]"
//            });
    	}
//    	dialog.alert ({
//			title : 'SearchCommonLocDC',
//			message : 'AFTER commDC= ' + commDC
//		});
    	return commDC;
    }
    
    function SearchItemDCLocation(itemID, subsidiary, channel, dropShipRetailer, createdPOb, sCommonDC) 
    {    	
    	var objLoc = new Object();
    	if (itemID && subsidiary && channel & sCommonDC){
    		var customrecord_location_configSearchObj = search.create({
    		   type: "customrecord_location_config",
    		   filters: [
    		      ["isinactive","is","F"], 
    		      "AND", 
    		      ["custrecord_loc_config_subsidiary","anyof",subsidiary], 
    		      "AND", 
    		      ["custrecord_loc_config_channel","anyof",channel], 
    		      "AND", 
//    		      ["custrecord_loc_config_region","anyof","1"], 
//    		      "AND", 
    		      ["custrecord_loc_config_special_order","is",createdPOb], 
    		      "AND", 
//    		      ["custrecord_loc_config_shared","is","T"], 
//    		      "AND", 
    		      ["custrecord_loc_config_drop_ship","is",dropShipRetailer], 
    		      "AND", 
    		      ["custrecord_loc_config_distr_center","anyof",sCommonDC], 
    		      "AND", 
    		      ["custrecord_loc_config_sku","anyof",itemID]
    		   ],
    		   columns: [
    		      search.createColumn({
    		         name: "custrecord_loc_config_sku",
    		         sort: search.Sort.ASC
    		      }),
    		      "custrecord_loc_config_subsidiary",
    		      "custrecord_loc_config_channel",
    		      "custrecord_loc_config_drop_ship",
    		      "custrecord_loc_config_special_order",
    		      "custrecord_loc_config_distr_center",
    		      "custrecord_loc_config_shared",
    		      "custrecord_loc_config_location",
    		      "custrecord_loc_config_region",
    		      "isinactive"
    		   ]
    		});
    		customrecord_location_configSearchObj.run().each(function(result){
    		   objLoc.DC = result.getValue('custrecord_loc_config_distr_center');
    		   objLoc.location = result.getValue('custrecord_loc_config_location');
    		});
    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "SearchItemDCLocation",
//                message: "Please enter required parameters before searching: [itemID && subsidiary && channel & sCommonDC]"
//            });
    	}
//    	dialog.alert({
//			title : 'SearchItemDCLocation',
//			message : 'AFTER objLoc= ' + objLoc.location + ', DC=' + objLoc.DC
//		});
    	return objLoc;
    }
    
    function SearchDirectRegionByState(sState){
    	var oRegion = new Object();    	
    	if (sState){
	    	var customrecord_nls_regionsSearchObj = search.create({
			   type: "customrecord_nls_regions",
			   filters: [
			      ["custrecord_region_state","anyof",sState]
			   ],
			   columns: [
			      "custrecord_region_low_zip",
			      "custrecord_region_high_zip",
			      "custrecord_nls_region",
			      "custrecord_region_state"
			   ]
			});
			var searchResultCount = customrecord_nls_regionsSearchObj.runPaged().count;
			var iRegion;
			if (searchResultCount && searchResultCount > 0){
				oRegion.count = searchResultCount;
				var preRegion = '';
				customrecord_nls_regionsSearchObj.run().each(function(result){
				   // .run().each has a limit of 4,000 results
				  iRegion = result.getValue('custrecord_nls_region');
				  if (iRegion != preRegion){
					preRegion = iRegion;  
				  }				  
				});
				if (iRegion && preRegion){
					oRegion.iRegion = iRegion;
					oRegion.preRegion = preRegion;
				}				
			}
    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "SearchDirectRegionByState",
//                message: "Please enter required parameters before searching: [sState]"
//            });
    	}
    	return oRegion;
    }
    
    function SearchDirectRegion(custShipToZip){
    	// US ONLY - zip code First 3 Letters in number
    	// Return Region List ID
    	var zipCode;		
    	var sZipFilter;
    	var objRegion = new Object();    	
    	if (custShipToZip){
    		var zip3Digit = custShipToZip.substr(0, 3);
    		zipCode = parseInt(custShipToZip.substr(0, 3), 10);
    		zip3Digit = " '" + zipCode + "' ";    		
//    		sZipFilter = "formulanumeric: CASE WHEN {custrecord_region_high_zip} >='" + zipCode + "' AND {custrecord_region_low_zip} <= '" + zipCode + "' THEN 1 ELSE 0 END";    	
    		sZipFilter = "formulanumeric: CASE WHEN TO_NUMBER(SUBSTR({custrecord_region_low_zip}, 0, 3)) <= " + zip3Digit + " AND TO_NUMBER(SUBSTR({custrecord_region_high_zip}, 0, 3)) >= " + zip3Digit + " THEN 1 ELSE 0 END";    		
//    		sZipFilter = 'formulanumeric: CASE WHEN TO_NUMBER(SUBSTR({custrecord_region_low_zip}, 0, 3)) <= \'' + zip3Digit + '\' AND TO_NUMBER(SUBSTR({custrecord_region_high_zip}, 0, 3)) >= \'' + zip3Digit + '\' THEN 1 ELSE 0 END';
//    		sZipFilter = "formulanumeric: CASE WHEN TO_NUMBER(SUBSTR({custrecord_region_low_zip}, 0, 3)) <= '986' AND TO_NUMBER(SUBSTR({custrecord_region_high_zip}, 0, 3)) >= '986' THEN 1 ELSE 0 END";
			
    		var customrecord_nls_regionsSearchObj = search.create({
    			   type: "customrecord_nls_regions",
    			   filters: [
//    			      ["formulanumeric: CASE WHEN TO_NUMBER(SUBSTR({custrecord_region_low_zip}, 0, 3)) <= '917' AND TO_NUMBER(SUBSTR({custrecord_region_high_zip}, 0, 3)) >= '917' THEN 1 ELSE 0 END","equalto","1"]
//    				  ["formulanumeric: CASE WHEN TO_NUMBER(SUBSTR({custrecord_region_low_zip}, 0, 3)) <= '091' AND TO_NUMBER(SUBSTR({custrecord_region_high_zip}, 0, 3)) >= '091' THEN 1 ELSE 0 END","equalto","1"]
    				  [sZipFilter,'equalto','1']
    			   ],
    			   columns: [
    			      "custrecord_region_low_zip",
    			      "custrecord_region_high_zip",
    			      "custrecord_nls_region",
    			      "custrecord_region_state"
    			   ]
    			});
    			objRegion.count = customrecord_nls_regionsSearchObj.runPaged().count;
    			customrecord_nls_regionsSearchObj.run().each(function(result){
    			   // .run().each has a limit of 4,000 results
    			   objRegion.iRegion = result.getValue('custrecord_nls_region');
    			   objRegion.id = result.id;
    			});
		
    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "_SearchDirectRegion",
//                message: "Please enter required parameters before searching: [custShipToZip]"
//            });
    	}

    	return objRegion;
    }
    
    function SearchDirectShipping(itemID, MOT, sSubsidiary, custShipToZip){
    	// Canada zip code First Letter in Upper case
    	// SearchDirectShipping(idItem, sMOT, sSubsidiary, custShipToZip)
    	var arrResult;
    	var oResult = new Object();
    	if (itemID && MOT){
    		var zipCode;
        	var sZipFilter;
	    	if (sSubsidiary == CONSTANT_SUBSIDIARY_US){
	    		zipCode = parseInt(custShipToZip.substr(0, 5), 10);
	    		sZipFilter = "formulatext: CASE WHEN {custrecord_nls_high_zip} >='" + zipCode + "' AND {custrecord_nls_low_zip} <= '" + zipCode + "' THEN 1 ELSE 0 END";    	
	    	}else {
	    		zipCode = custShipToZip.charAt(0).toUpperCase();
	    		sZipFilter = "formulatext: CASE WHEN UPPER({custrecord_nls_high_canada_prov_terr}) >='" + zipCode + "' AND UPPER({custrecord_nls_low_canada_prov_terr}) <='" + zipCode + "' THEN 1 ELSE 0 END";			
	    	}
	    	var searchDirectShipping = search.create({
			   type: "customrecord_nls_direct_shipping",
			   filters: [
			      ["custrecord_nls_item","anyof",itemID], 
			      "AND", 
			      ["custrecord_nls_mode","anyof",MOT], 
			      "AND", 
			      [sZipFilter,"is","1"]
			   ],
			   columns: [
			      "custrecord_nls_item",
			      "custrecord_nls_mode",
			      "custrecord_nls_low_zip",
			      "custrecord_nls_high_zip",
			      "custrecord_nls_low_canada_prov_terr",
			      "custrecord_nls_high_canada_prov_terr",
			      "custrecord_nls_shipping_carrier",
			      "custrecord_nls_assigned_carrier",
			      "custrecord_nls_per_unit_shipping_charge"
			   ]
			});
	    	
//	    	searchDirectShipping.run().each(function(result){
//			   arrResult = result;
//			});
	    	
	    	oResult.count = searchDirectShipping.runPaged().count;
	    	searchDirectShipping.run().each(function(result){
			   // .run().each has a limit of 4,000 results
				oResult.result = result;
			});			
			
    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "_SearchDirectShipping",
//                message: "Please enter required parameters before searching: [itemID && MOT]"
//            });
    	}
		return oResult;;
    }
    
    function SearchBandedShippingRate(fAmount, sMOT, Country)
    {
    	// Look up the banded rate based on the total of shipping line (Location + Ship TO + Ship Via) 
    	var fBandRate = 0;    	
    	if (sMOT && Country){    		
    		fAmount = forceParseFloat(fAmount);
    		if (fAmount > 0){   				
	    		var sAmountFilter = "formulanumeric: CASE WHEN to_number({custrecord_high_range}) >=" + fAmount + " AND to_number({custrecord_low_range}) <= " + fAmount + " THEN 1 ELSE 0 END"; 
		    	var searchBandedShippingRates = search.create({
				   type: "customrecord_banded_shipping_rates",
				   filters: [			      
				      ["custrecord_nls_mot","anyof", sMOT], 
				      "AND",
				      ["custrecord_country","anyof", Country], 
				      "AND", 
				      [sAmountFilter,"equalto","1"]
				   ],
				   columns: [
				      "custrecord_charge",
				      "custrecord_low_range",
				      "custrecord_high_range",
				      "custrecord_country"
				   ]
				});
		    	
		    	searchBandedShippingRates.run().each(function(result){
					fBandRate = result.getValue('custrecord_charge');
				});
//		    	dialog.alert ({
//					title : 'SearchBandedShippingRate',
//					message : 'fBandRate=' + fBandRate + ', fAmount=' + fAmount + ', Country=' + Country + ', sMOT=' + sMOT
//				});
    		}
    		
    	} else {
//    		throw error.create({
//                name: 'MISSING_REQ_PARAM_' + "_SearchBandedShippingRates",
//                message: "Please enter required parameters before searching: [sMOT && Country] + fAmount=" + fAmount + ', sMOT=' + sMOT + ', Country=' + Country
//            });
    	}
		return fBandRate;
    }
        
    function SearchAPPromoDisc(stCouponCode){
    	// Custom Record: AP Promotion Discount
    	var arrResult;
    	if (stCouponCode) {
    		var customrecord_advpromo_discountSearchObj = search.create({
			   type: "customrecord_advpromo_discount",
			   filters: [
			      ["custrecord_advpromo_discount_type","equalto","3"], 
			      "AND", 
			      ["custrecord_advpromo_discount_promo_code","anyof",stCouponCode]
			   ],
			   columns: [
			      "custrecord_advpromo_discount_promo_code",
			      "custrecord_advpromo_discount_description",
			      "custrecord_advpromo_discount_isf_smethod"
			   ]
			});
			customrecord_advpromo_discountSearchObj.run().each(function(result){
				var iPromoCode = result.getValue('custrecord_advpromo_discount_promo_code');
//				dialog.alert ({
//					title : 'SearchAPPromoDisc',
//					message : 'stCouponCode=' + stCouponCode + ', iPromoCode=' + iPromoCode
//				});
				arrResult = result;
			});
    	}
    	return arrResult;
    }
    
    function SearchAPPromoShip(stCouponCode){
    	// Custom Record: AP Promotion Shipping Price
    	var arrResult;
    	if (stCouponCode) {
    		//filterSPD.push(new nlobjSearchFilter('custrecord_advpromo_discount_promo_code', 'custrecord_advpromo_sprice_discount', 'anyof', stCouponCode));	
    		var customrecord_advpromo_shipping_priceSearchObj = search.create({
			   type: "customrecord_advpromo_shipping_price",
			   filters: [
				   ["custrecord_advpromo_sprice_discount.custrecord_advpromo_discount_promo_code","anyof",stCouponCode]
			   ],
			   columns: [
			      search.createColumn({
			         name: "id",
			         sort: search.Sort.ASC
			      }),
			      "custrecord_advpromo_sprice_discount",
			      "custrecord_advpromo_sprice_amount",
			      "custrecord_advpromo_sprice_currency",
			      "custrecord_advpromo_sprice_is_percent",
			      search.createColumn({
			         name: "custrecord_advpromo_discount_promo_code",
			         join: "CUSTRECORD_ADVPROMO_SPRICE_DISCOUNT"
			      })
			   ]
			});
			customrecord_advpromo_shipping_priceSearchObj.run().each(function(result){
				var bPercent = result.getValue('custrecord_advpromo_sprice_is_percent');		
//				dialog.alert ({
//					title : 'SearchAPPromoShip',
//					message : 'stCouponCode=' + stCouponCode + ', bPercent=' + bPercent
//				});
				arrResult = result;
			});			
    	}
    	
    	return arrResult;
    }
    
    function SearchPromotionCode(sPromoCode){
    	var PromoResult;
    	var promoItem;
    	var promotioncodeSearchObj = search.create({
    		   type: "promotioncode",
    		   filters: [
    		      ["internalid","anyof",sPromoCode]
    		   ],
    		   columns: [
    		      search.createColumn({
    		         name: "name",
    		         sort: search.Sort.ASC
    		      }),
    		      "code",
    		      "isinactive",
    		      "discount",
    		      "custrecord_nls_shipping_discounted_item",
    		      search.createColumn({
    		         name: "itemid",
    		         join: "CUSTRECORD_NLS_SHIPPING_DISCOUNTED_ITEM"
    		      }),
    		      search.createColumn({
    		         name: "internalid",
    		         join: "CUSTRECORD_NLS_SHIPPING_DISCOUNTED_ITEM"
    		      })
    		   ]
    		});
    		promotioncodeSearchObj.run().each(function(result){
    			promoItem = result.getValue('custrecord_nls_shipping_discounted_item');
//    			dialog.alert ({
//					title : 'SearchPromotionCode result.id=' + result.id,
//					message : 'sPromoCode=' + sPromoCode + ', promoItem=' + promoItem
//				});
    			PromoResult = result;    			
    		});
    		
    	return promoItem;
    }
    
    function SearchPromotionByCode(sCouponCode){
    	var idPromo = '';
    	if (sCouponCode){
    		var promotioncodeSearchObj = search.create({
    			   type: "promotioncode",
    			   filters: [
    				  ["internalid","anyof",sCouponCode]
    			   ],
    			   columns: [
    			      "name",
    			      search.createColumn({
    			         name: "code",
    			         sort: search.Sort.ASC
    			      }),
    			      "isinactive"
    			   ]
    			});
    		promotioncodeSearchObj.run().each(function(result){
    		   idPromo = result.id;
    		});
    	}
//    	dialog.alert ({
//			title : 'SearchPromotionByCode',
//			message : "idPromo= " + idPromo + ', sCouponCode=' + sCouponCode
//		});
    	return idPromo;
    }    
    
    function SearchDisabledColumns()
    {
    	// Parent Disabled Column Fields
    	var DisabledResult = new Array();
    	
    	var customrecord_parent_disabled_col_fldsSearchObj = search.create({
    		   type: "customrecord_parent_disabled_col_flds",
    		   filters: [
    		      ["isinactive","is","F"]
    		   ],
    		   columns: [
    		      "custrecord_disabled_field",
    		      "custrecord_disabled_field_id"
    		   ]
    		});
    		var searchResultCount = customrecord_parent_disabled_col_fldsSearchObj.runPaged().count;
    		customrecord_parent_disabled_col_fldsSearchObj.run().each(function(result){    		   
    			DisabledResult.push(result);
    		   return true;
    		});
    		
    	return DisabledResult; 
    }
    
    function SearchEnabledColumns(userRole)
    {
		// Child Disabled Column Fields
    	var EnabledResult = new Array();    	
		
		var customrecord_chld_disabled_col_fldsSearchObj = search.create({
			   type: "customrecord_chld_disabled_col_flds",
			   filters: [
			      ["isinactive","is","F"], 
			      "AND", 
			      ["custrecord_enable_for_role","anyof",userRole]
			   ],
			   columns: [
			      search.createColumn({
			         name: "id",
			         sort: search.Sort.ASC
			      }),
			      "custrecord_par_disabled_col_flds",
			      "custrecord_enable_for_role"
			   ]
			});
			var searchResultCount = customrecord_chld_disabled_col_fldsSearchObj.runPaged().count;
			customrecord_chld_disabled_col_fldsSearchObj.run().each(function(result){
				EnabledResult.push(result);
			   return true;
			});
			
    	return EnabledResult; 	
    }
    
    function SearchFOBPriceLevels(custPriceLevel){    	
    	// Total of 23 records in the FOB Price Level custom record
    	var arrFobPriceLevel = new Array();
    	var searchFobPriceLevel = search.create({
    		type: "customrecord_fob_price_level",
    		filters: [
    			['custrecord_price_level','anyof',custPriceLevel],
    			"AND",
    			['isinactive','is','F']
    		],
    		columns: [
    			'custrecord_price_level',
    			'custrecord_fob_price_level'
    		]
    	});
    	searchFobPriceLevel.run().each(function(result){
//    		fobPriceLevel.priceLevel = result.getValue('custrecord_price_level');
    		arrFobPriceLevel.push(result);
    		return true;
    	});

    	return arrFobPriceLevel;
    }
    
    function SearchItemPriceLevel(itemID, subsidiary, PriceLvl, currency){
    	var arrItemPrices = new Array();
    	var itemSearchObj = search.create({
    		   type: "item",
    		   filters: [
    		      ["internalidnumber","equalto",itemID], 
    		      "AND", 
    		      ["subsidiary","anyof",subsidiary], 
    		      "AND", 
    		      ["pricing.pricelevel","anyof",PriceLvl], 
    		      "AND", 
    		      ["pricing.currency","anyof",currency]
    		   ],
    		   columns: [
    		      "itemid",
    		      "displayname",
    		      "type",
    		      "subsidiary",
    		      search.createColumn({
    		         name: "pricelevel",
    		         join: "pricing",
    		         sort: search.Sort.ASC
    		      }),
    		      search.createColumn({
    		         name: "unitprice",
    		         join: "pricing"
    		      }),
    		      search.createColumn({
    		         name: "currency",
    		         join: "pricing"
    		      })
    		   ]
    		});
    		var searchResultCount = itemSearchObj.runPaged().count;
    		itemSearchObj.run().each(function(result){
    			var priceLvl = result.getValue({
    				name: 'pricelevel',
    				join: 'pricing'
    			});
    			arrItemPrices.push(priceLvl);
    		   return true;
    		});
    		
//    	var itemSearchObj = search.create({
//    		   type: "item",
//    		   filters: [
//    		      ["internalidnumber","equalto",itemID]
//    		   ],
//    		   columns: [
//    		      "itemid",
//    		      "displayname",
//    		      "type",
//    		      search.createColumn({
//    		         name: "pricelevel",
//    		         join: "pricing",
//    		         sort: search.Sort.ASC
//    		      }),
//    		      search.createColumn({
//    		         name: "unitprice",
//    		         join: "pricing"
//    		      })
//    		   ]
//    		});
//    		var searchResultCount = itemSearchObj.runPaged().count;
//    		itemSearchObj.run().each(function(result){
//    		   // .run().each has a limit of 4,000 results
//    			var priceLvl = result.getValue({
//    				name: 'pricelevel',
//    				join: 'pricing'
//    			});
//    			arrItemPrices.push(priceLvl);
//    		   return true;
//    		});
    	return arrItemPrices;
    }
    
    function SearchOneItemCountDown(subsidiary, sub_channel, sItem){
    	// Search Item Count Down table to Increase the Counter for Cancel, Closed, Delete scenario 
    	var arrSearchResults;
    	if (subsidiary && sub_channel && sItem) {
    		var searchOneItemCountDown = search.create({
 			   type: "customrecord_nls_item_count_down",
 			   filters: [
 				   ["custrecord_nls_icd_subsidiary","is",subsidiary],
 				   'AND',
 				   ['custrecord_nls_icd_sub_channel','is', sub_channel],
 				   'AND',
 				   ['custrecord_nls_icd_item', 'is', sItem],
 				   'AND',
 				   ['custrecord_nls_icd_start', 'is', 'T']
 			   ],
 			   columns: [ 			      
 			      "custrecord_nls_icd_item",
 			      "custrecord_nls_icd_start",
 			      "custrecord_nls_icd_start_qty"
 			   ]
 			});
    		searchOneItemCountDown.run().each(function(result){ 	
    			var iQty = result.getValue('custrecord_nls_icd_start_qty');
    			arrSearchResults = result;
// 				dialog.alert ({
// 					title : 'SearchOneItemCountDown',
// 					message : 'subsidiary=' + subsidiary + ', sub_channel=' + sub_channel + ', sItem=' + sItem + ', result.id=' + result.id + ', iQty=' + iQty
// 				}); 				
 			});			
    	}    	
    	return arrSearchResults;
    }
    /**
     * Search General Hold custom record by sales order Internal ID
     * @param soInternalID, Hold Status = Hold
     * Hold Reason = Await Customer Econsent
     * @returns objResult.holdReason, objResult.count
     */
    function SearchEconsentHoldBySO(soInternalID){
    	var objResult = new Object();
    	if (soInternalID){
    		var objSearchHoldBySO = search.create({
			   type: "customrecord_nls_general_hold",
			   filters: [
			      ["custrecord_nls_gh_hold_reason","anyof","7"], 
			      "AND", 
			      ["custrecord_nls_gh_hold_status","anyof","2"], 
			      "AND", 
			      ["custrecord_nls_gh_hold_transaction.internalidnumber","equalto",soInternalID], 
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
			      "custrecord_nls_gh_hold_transaction"
			   ]
			});
			objResult.count = objSearchHoldBySO.runPaged().count;
			objSearchHoldBySO.run().each(function(result){
			   // .run().each has a limit of 4,000 results
			   objResult.holdReason = result.getValue('custrecord_nls_gh_hold_reason');
			   objResult.id = result.id;
			});
    	}
		return objResult;
    }
    
	function forceParseFloat(stValue)
	{
		var flValue = parseFloat(stValue);
	    
	    if (isNaN(flValue))
	    {
	        return 0.00;
	    }
	    
	    return flValue;
	}
	function forceParseInt(stValue) {
		return (isNaN(parseInt(stValue, 10)) ? 0.00 : parseInt(stValue, 10));
	}
	function inArray(a, obj)
	{
		var i = a.length;
		while (i--)
		{
			if (a[i] == obj)
			{
				return true;
			}
		}
		return false;
	}
/**
 * Determine if Ship Complete Sales Order based on the payment methods
 * @param sPaymentMethod
 * @param sNLSPayMethod
 * @param sFinancingCo
 * @returns
 */
	function QualifySettleComplete(sPaymentMethod, sNLSPayMethod, sFinancingCo)
	{
		// Change function name: DF-9521 Direct Orders should settle complete based on payment method or finance partner
		var NLS_MULTI_PAY = '1';
		var NLS_SPLIT_PAY = '2';
		var NS_FINANCING = '14';
		var NLS_FINANCING = '6';
		
		var bShipComplete = false;
		if (sPaymentMethod || sNLSPayMethod) {
			// Progressive Leasing
			if (sNLSPayMethod === NLS_PAY_TYPE_LEASING && sPaymentMethod === NS_PAY_METHOD_LEASING){
				bShipComplete = true;
			} 
			else if (sNLSPayMethod === NLS_MULTI_PAY || sNLSPayMethod === NLS_SPLIT_PAY){
				bShipComplete = true;
			}
			else if (sFinancingCo && sFinancingCo != ''){
				if (sPaymentMethod === NS_FINANCING || sNLSPayMethod === NLS_FINANCING) {
//					var objFinPartner = nlapiLookupField('customrecord_nls_fp',sFinancingCo, 'custrecord_nls_fp_ship_complete');
					var objFinPartner = search.lookupFields({
		    		    type: 'customrecord_nls_fp',
		    		    id: sFinancingCo,
		    		    columns: ['custrecord_nls_fp_ship_complete']
		    		});		    		
		    		
					if (objFinPartner) {
						bShipComplete = objFinPartner.custrecord_nls_fp_ship_complete;
					}
				}
			}
		}
//		log.debug({
//			title: "QualifyShipComplete bShipComplete=" + bShipComplete, 
//			details: 'sPaymentMethod: ' + sPaymentMethod + ', sNLSPayMethod=' + sNLSPayMethod + ', sFinancingCo=' + sFinancingCo	    		
//		});
		return bShipComplete;
	}
    return {
    	SearchOneItemCountDown: SearchOneItemCountDown,    
    	SearchFOBPriceLevels: SearchFOBPriceLevels,
    	SearchItemPriceLevel: SearchItemPriceLevel,
    	SearchDisabledColumns: SearchDisabledColumns,
    	SearchEnabledColumns: SearchEnabledColumns,
    	SearchCommonLocDC: SearchCommonLocDC,
    	SearchItemDCLocation: SearchItemDCLocation,
    	SearchCustomerAddrID: SearchCustomerAddrID,
    	SearchRetailCustAddress: SearchRetailCustAddress,
    	SearchItemDCFields: SearchItemDCFields,
    	SearchLocationConfig: SearchLocationConfig,
    	SearchDirectRegionByState: SearchDirectRegionByState,
    	SearchDirectRegion: SearchDirectRegion,
    	SearchDirectShipping: SearchDirectShipping,
    	SearchBandedShippingRate: SearchBandedShippingRate,
    	SearchAPPromoDisc: SearchAPPromoDisc,
    	SearchAPPromoShip: SearchAPPromoShip,
    	SearchPromotionCode: SearchPromotionCode,
    	SearchPromotionByCode: SearchPromotionByCode,
    	SearchEconsentHoldBySO: SearchEconsentHoldBySO,
    	QualifySettleComplete: QualifySettleComplete,
    	inArray: inArray,
    	forceParseInt: forceParseInt,
    	forceParseFloat: forceParseFloat
    };
    
});
