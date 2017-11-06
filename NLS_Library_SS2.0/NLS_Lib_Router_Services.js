/**
 * Library for Nautilus Finance Router service Calls and Progressive Leasing API calls 
 * Author: KCHANG
 */
define(['N/log', 'N/runtime', 'N/xml', 'N/error'],
/**
 * @param {https} https
 * @param {runtime} runtime
 */
function(log, runtime, xml, error) {
	/**
	 * Library file for Nautilus Router service Call
	 * Author: KCHANG
	 */
	function GetNLSRouterURL(sEnv)
	{
		// Progressive Leasing Process #1 Application and #2 Submit Invoice
		var sURL = '';
		if (sEnv) {			
			switch (sEnv) {
				case 'SANDBOX':
					sURL = 'https://devrouter.nautilus.com/RouterIntegration.asmx';
					break;
				case 'PRODUCTION':				
					//sURL = 'https://nsrouter.nautilus.com/RouterIntegration.asmx';
					sURL = 'https://prodrouter.nautilus.com/RouterIntegration.asmx';					
					break;
				default:
					sURL = 'https://devrouter.nautilus.com/RouterIntegration.asmx';
					break;
			}
		}
		else
		{
			throw error.create({
                name: 'MISSING_REQ_PARAM' + "_GetNLSRouterURL",
                message: "Please enter required parameters: sEnv=" + sEnv
            });
		}
		return sURL;
	}
	
	function GetProgressiveLeasingURL(sEnv)
	{
		// Progressive Leasing Process #3 Request Order Status and #4 Send Delivery Date
		var sURL = '';
		if (sEnv) {			
			switch (sEnv) {
				case 'SANDBOX':
					sURL = 'https://demo.progressivelp.com/ApplicationBeta/Application.svc';
					break;
				case 'PRODUCTION':				
					sURL = 'https://www.progressivelp.com/Application/Application.svc';
					break;
				default:
					sURL = 'https://demo.progressivelp.com/ApplicationBeta/Application.xsd';
					break;
			}
		}
		else
		{
			throw error.create({
                name: 'MISSING_REQ_PARAM_' + "GetProgressiveLeasingURL",
                message: "Please enter required parameters: sEnv=" + sEnv
            });
		}
		return sURL;
	}
	
	function BuildFinanceRequestXML(sEnv, sAction, sInData){
		// Progressive Leasing Process #1 & #2
		var sLoginName = '';
		var sPW = '';
		switch(sEnv) 	
		{	
			case 'SANDBOX':
				sLoginName = '3TR';
				sPW = 'Test212';
				break;
			case 'PRODUCTION':
				sLoginName = 'NST';
				sPW = 'Ru3tz#!91';						
				break;
			default:
				break;
		}
		var xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
		xmlHeader += '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">';
		xmlHeader += '<soap:Body><Execute xmlns="http://tempuri.org/"><requestMessage><![CDATA[<Message><Control><OriginSystem>Netsuite</OriginSystem><DestinationSystem>Finance</DestinationSystem>';
		
		var strRequestBody = '<Client><LoginName>' + sLoginName + '</LoginName><Password>' + sPW + '</Password></Client><Queue /></Control>';
		strRequestBody += '<Request><Action>' + sAction + '</Action><ActionOptions/><Data>' + sInData + '</Data></Request></Message>';

		var postEnd = ']]></requestMessage></Execute></soap:Body></soap:Envelope>';
			
		var strRequest = xmlHeader + strRequestBody + postEnd;
				
		return strRequest;
	}
	
	function BuildNLSRequestXML(sEnv, sAction, sInData)
	{
		var sLoginName = '';
		var sPW = '';
		switch(sEnv) 	
		{	
			case 'SANDBOX':
				sLoginName = '3TR';
				sPW = 'Test212';
				break;
			case 'PRODUCTION':
				if (sCompID == 'TSTDRV825073') {
					// Training account
					sLoginName = '3TR';
					sPW = 'Test212';	
				}
				else{
					sLoginName = 'NST';
					sPW = 'Ru3tz#!91';
				}
						
				break;
			default:
				break;
		}
		var xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
		xmlHeader += '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">';
		xmlHeader += '<soap:Body><Execute xmlns="http://tempuri.org/"><requestMessage><![CDATA[';
				
		var strRequestBody = '<Message><Control><OriginSystem>Netsuite</OriginSystem><Client><LoginName>' + sLoginName + '</LoginName><Password>' + sPW + '</Password></Client><Queue /></Control>';
		strRequestBody += '<Request><Action>' + sAction + '</Action><ActionOptions/><Data>' + sInData + '</Data></Request><Reply><Status/><StatusMessage/><Data/><Errors/></Reply></Message>';
		
		var postEnd = ']]></requestMessage></Execute></soap:Body></soap:Envelope>';
			
		var strRequest = xmlHeader + strRequestBody + postEnd;
				
		return strRequest;
	}

	function setRequestNodeValue(strNode, strPath, strValue)
	{
		//NLS Generic XML Function: Set Request XML node value
		var strOutputNode = "";
		try
		{
			var a = strPath.split("/");
			var lastStartNodeIndex=0;
			var i=0;
			for(i=0; i<a.length; i++)
			{
	  			a[i] = "<" + a[i] + ">";    
	  			if(strNode.indexOf(a[i], lastStartNodeIndex) == -1)
	  			{
	     			throw "Incorrect Path or Path not found:" + strPath;
	  			}
	  			else
	  			{
	     			lastStartNodeIndex = strNode.indexOf(a[i], lastStartNodeIndex) + a[i].length - 1;  
	  			}			
			}
			var endNode = a[a.length-1].replace("<", "</");
			var endNodeIndex = strNode.indexOf(endNode, lastStartNodeIndex);
			strOutputNode = strNode.substring(0, lastStartNodeIndex + 1) + strValue + strNode.substring(endNodeIndex);
		}
		catch(err)
		{
			throw error.create({
                name: 'Unexpected_Error' + "_setRequestNodeValue",
                message: "Unexpected Error: " + err
            });
		}
		return strOutputNode;
	}

	function processReplyStatus(str_responseBody)
	{	
//		var str_statusMessage = '';
		var str_status = '';	
		try {		
			//parse response
			var xmlDoc = nlapiStringToXML(str_responseBody);
			var str_result = nlapiSelectValue(xmlDoc, "//*[name()='ExecuteResult']");
			var xmlDoc2 = nlapiStringToXML(str_result);
			str_status = nlapiSelectValue(xmlDoc2, "//Message/Reply/Status");		
//			str_statusMessage = nlapiSelectValue(xmlDoc2, "//Message/Reply/StatusMessage");				
		}
		catch(e){
			throw error.create({
                name: 'Unexpected_Error' + "_processReplyStatus",
                message: "Unexpected Error: " + e
            });
		}
		
		return str_status;	
	}

	function PL_RequestStatusWithDeliveryConfirmation(sEnv, sAccountNumber){
		// Progressive Leasing - Process #3 Action = RequestStatusWithDeliveryConfirmation
		var sLoginName = '';
		var sPW = '';

		switch(sEnv) 	
		{	
			case 'SANDBOX':
				sLoginName = 'onlineappuser81110';
				sPW = 'progfin09';
				break;
			case 'PRODUCTION':
				sLoginName = 'onlineappuser90151';
				sPW = 'progfin09';
				break;
			default:
				break;
		}
		
		var xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
		xmlHeader += '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:app="http://progfinance.com/Application"><soapenv:Header/>';
		xmlHeader += '<soapenv:Body><app:RequestStatusWithDeliveryConfirmation>';

		var strRequestBody = '<app:request xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><app:Authentication><app:Username>' + sLoginName + '</app:Username><app:Password>' + sPW + '</app:Password><app:IPAddress/><app:ChainStoreNumber/><app:Source/></app:Authentication>';
		strRequestBody += '<app:ApplicationId><app:StoreApplicationIdentifier/><app:AccountNumber>' + sAccountNumber + '</app:AccountNumber></app:ApplicationId></app:request>';
		var postEnd = '</app:RequestStatusWithDeliveryConfirmation></soapenv:Body></soapenv:Envelope>';
		var strRequest = xmlHeader + strRequestBody + postEnd;
				
		return strRequest;
	}
	
	function PL_SubmitDeliveryConfirmation(sEnv, sAccountNumber, dDeliveryDate, idCS){
		// Progressive Leasing - Process #4 Action = SubmitDeliveryConfirmations
		var sLoginName = '';
		var sPW = '';
		var StoreId = '';
		switch(sEnv) 	
		{	
			case 'SANDBOX':
				sLoginName = 'onlineappuser81110';
				sPW = 'progfin09';
				StoreId = '81110';
				break;
			case 'PRODUCTION':
				sLoginName = 'onlineappuser90151';
				sPW = 'progfin09';
				StoreId = '90151';
				break;
			default:
				break;
		}

		var xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
		xmlHeader += '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:app="http://progfinance.com/Application"><soapenv:Header/>';
		xmlHeader += '<soapenv:Body><app:SubmitDeliveryConfirmations>';
		var strRequestBody = '<app:request><app:Authentication><app:Username>' + sLoginName + '</app:Username><app:Password>' + sPW + '</app:Password><app:Source/></app:Authentication>';
		strRequestBody += '<app:Store><app:StoreId>' + StoreId + '</app:StoreId><app:StoreName/><app:StoreApplicationIdentifier/></app:Store>';
		strRequestBody += '<app:DeliveryConfirmations><app:DeliveryConfirmation><app:AccountNumber>' + sAccountNumber + '</app:AccountNumber><app:DeliveryDate>' + dDeliveryDate + '</app:DeliveryDate>';
		strRequestBody += '<app:StoreApplicationIdentifier>' + idCS + '</app:StoreApplicationIdentifier></app:DeliveryConfirmation></app:DeliveryConfirmations></app:request>';
		var postEnd = '</app:SubmitDeliveryConfirmations></soapenv:Body></soapenv:Envelope>';

		var strRequest = xmlHeader + strRequestBody + postEnd;
				
		return strRequest;
	}
	
	function PL_ProcessSubmitDeliveryConfirmation(str_responseBody){
		var objSubmitDeliveryResponse = new Object();
		try {
			//parse response
			var xmlDoc = xml.Parser.fromString({
				text : str_responseBody
			});
			var resultNode = xml.XPath.select({
				node : xmlDoc,
				xpath : "//*[name()='SubmitDeliveryConfirmationsResponse']"
			});
			objSubmitDeliveryResponse.status = "Failure";
			objSubmitDeliveryResponse.ErrorCode = "";
			objSubmitDeliveryResponse.errorMessage="";			
			objSubmitDeliveryResponse.errorSource = "Progressive Leasing Submit Delivery";
			objSubmitDeliveryResponse.replyMsg = "";
			objSubmitDeliveryResponse.accountNumber = "";
			
			if (resultNode && resultNode[0]){
				var str_result = resultNode[0].textContent;
				if (str_result){
					objSubmitDeliveryResponse.replyMsg = str_result;
				}

				var sErrors = resultNode[0].getElementsByTagName({
                    tagName : 'Errors'
                })[0].textContent;                
                
                
				if (!sErrors){
					objSubmitDeliveryResponse.status = "SUCCESS";					
				} else {
					var AcctNum = resultNode[0].getElementsByTagName({
	                    tagName : 'AccountNumber'
	                })[0].textContent;
				
					if (AcctNum){
						objSubmitDeliveryResponse.ErrorCode = "Error-" + AcctNum;
						objSubmitDeliveryResponse.accountNumber = AcctNum;
					}
					var sErrorMsg = resultNode[0].getElementsByTagName({
		                    tagName : 'ErrorMessage'
		                })[0].textContent;
					
					if (sErrorMsg){
						objSubmitDeliveryResponse.errorMessage = sErrorMsg;
					}
				}
			} else {
				// Fault?xpath : "//*[name()='RequestStatusWithDeliveryConfirmationResponse']"
				var FaultNode = xml.XPath.select({
					node : xmlDoc,
					xpath : "//*[name()='s:Fault']"
				});
				if (FaultNode && FaultNode[0]){
					// Fault Code
					var faultCode = FaultNode[0].firstChild.textContent;
					if (faultCode){
						objSubmitDeliveryResponse.ErrorCode = faultCode;
					}
					// Fault String
					var sErrorMsg = FaultNode[0].getElementsByTagName({
	                    tagName : 'faultstring'
	                })[0].textContent;
					
					if (sErrorMsg){
						objSubmitDeliveryResponse.errorMessage = sErrorMsg;
					}
//					log.debug({
//						title: "PL_ProcessRespStatusWithDeliveryConfirmation FAULT",
//						details: "faultCode=" + faultCode + ", sErrorMsg: " + sErrorMsg 
//					});
				} 
			}
		} catch(e){	
			objSubmitDeliveryResponse.errorSource = "Unknown Error";
			objSubmitDeliveryResponse.errorMessage = 'PL_ProcessSubmitDeliveryConfirmation Call to Progressive Leasing Failed.  Error Message:' + e.message;
		}
		return objSubmitDeliveryResponse;	
	}
	
	function PL_ProcessRespStatusWithDeliveryConfirmation(str_responseBody){
		//s:Body/RequestStatusWithDeliveryConfirmationResponse/RequestStatusWithDeliveryConfirmationResult 
		var objOrderDeliveryStatusResponse = new Object();
		try {		
			//parse response
			var xmlDoc = xml.Parser.fromString({
				text : str_responseBody
			});
			var resultNode = xml.XPath.select({
				node : xmlDoc,
				xpath : "//*[name()='RequestStatusWithDeliveryConfirmationResponse']"
			});
			objOrderDeliveryStatusResponse.status = "Failure";
			objOrderDeliveryStatusResponse.ErrorCode = "";
			objOrderDeliveryStatusResponse.errorMessage="";
			objOrderDeliveryStatusResponse.eSignURL = "";
			objOrderDeliveryStatusResponse.statusReason = "";
			objOrderDeliveryStatusResponse.approvalStatus = "";
			objOrderDeliveryStatusResponse.errorSource = "Progressive Leasing OK to Deliver";
			
			if (resultNode && resultNode[0]){
				var str_result = resultNode[0].textContent;
				if (str_result){
					objOrderDeliveryStatusResponse.replyMsg = str_result;
				}
//				for (var i = 0; i < resultNode.length; i++) {
				var AcctNum = resultNode[0].getElementsByTagName({
                    tagName : 'AccountNumber'
                })[0].textContent;
                var sTagValue="AcctNum= " + AcctNum;
                
                var strStatus = resultNode[0].getElementsByTagName({
                    tagName : 'ApprovalStatus'
                })[0].textContent;
                var eSignURL = resultNode[0].getElementsByTagName({
                    tagName : 'EsignURL'
                })[0].textContent;
                var bDeliverOK = resultNode[0].getElementsByTagName({
                    tagName : 'OkayToDeliverMerchandise'
                })[0].textContent;
                var approveLimit = resultNode[0].getElementsByTagName({
                	tagName: 'ApprovalLimit'
                })[0].textContent;
                var statusReason = resultNode[0].getElementsByTagName({
                    tagName : 'StatusReason'
                })[0].textContent;
                
                sTagValue += ', ApprovalStatus: ' + strStatus + ' eSignURL: ' + eSignURL + ' bDeliverOK: ' + bDeliverOK + ", approveLimit: " + approveLimit;

//				log.debug({
//					title: "PL_ProcessRespStatusWithDeliveryConfirmation",
//					details: "sTagValue= " + sTagValue
//				});
				if (AcctNum){
					objOrderDeliveryStatusResponse.accountNumber = AcctNum;
				}
				if (strStatus){
					objOrderDeliveryStatusResponse.approvalStatus = strStatus;
					objOrderDeliveryStatusResponse.status = "SUCCESS";
				} else
				if (eSignURL){	
					objOrderDeliveryStatusResponse.eSignURL = eSignURL;
				} 
				if (bDeliverOK){			
					objOrderDeliveryStatusResponse.bDeliverOK = bDeliverOK;
				} 
				if (approveLimit){
					objOrderDeliveryStatusResponse.approvalLimit = approveLimit;
				}
				if (statusReason){
					objOrderDeliveryStatusResponse.statusReason = statusReason;
				}
			} else {
				// Fault?xpath : "//*[name()='RequestStatusWithDeliveryConfirmationResponse']"
				var FaultNode = xml.XPath.select({
					node : xmlDoc,
					xpath : "//*[name()='s:Fault']"
				});
				if (FaultNode && FaultNode[0]){
					// Fault Code
					var faultCode = FaultNode[0].firstChild.textContent;
					if (faultCode){
						objOrderDeliveryStatusResponse.ErrorCode = faultCode;
					}
					// Fault String
					var sErrorMsg = FaultNode[0].getElementsByTagName({
	                    tagName : 'faultstring'
	                })[0].textContent;
					
					if (sErrorMsg){
						objOrderDeliveryStatusResponse.errorMessage = sErrorMsg;
					}
//					log.debug({
//						title: "PL_ProcessRespStatusWithDeliveryConfirmation FAULT",
//						details: "faultCode=" + faultCode + ", sErrorMsg: " + sErrorMsg 
//					});
				} 
			}
		} catch(e){	
			objOrderDeliveryStatusResponse.errorSource = "Unknown Error";
			objOrderDeliveryStatusResponse.errorMessage = 'PL_ProcessRespStatusWithDeliveryConfirmation Call to Progressive Leasing Failed.  Error Message:' + e.message;
		}
		return objOrderDeliveryStatusResponse;	
	}
	
	function processProgLeaseResp_SubmitOrder(str_responseBody)
	{	
		var objSubmitOrderResponse = new Object();
		try {		
			//parse response
			var xmlDoc = xml.Parser.fromString({
				text : str_responseBody
			});

			var resultNode = xml.XPath.select({
				node : xmlDoc,
				xpath : "//*[name()='ExecuteResult']"
			});
			if (resultNode){				
				var str_result = resultNode[0].firstChild.textContent;
				var xmlDoc2 = xml.Parser.fromString({
					text : str_result
				});

				var statusNode = xml.XPath.select({
					node : xmlDoc2,
					xpath : "//Message/Reply/Status"
				});
				if (statusNode){
					var str_status = statusNode[0].firstChild.textContent;
					objSubmitOrderResponse.status = str_status;
				}
				var sEsignURL;
				if(str_status === 'Success') {
					var urlNode = xml.XPath.select({
						node : xmlDoc2,
						xpath : "//Message/Reply/Data/SubmitOrderInformationResponse/EsignURL"
					});
					if (urlNode){
						sEsignURL = urlNode[0].firstChild.textContent;				
						objSubmitOrderResponse.eSignURL = sEsignURL;
					}
				}		
				else {
					// Get Error Message	
					var errorStatusNode = xml.XPath.select({
						node : xmlDoc2,
						xpath : "//Message/Reply/Data/Errors/Error/Number"
					});					
					if (errorStatusNode){
						objSubmitOrderResponse.errorNumber = errorStatusNode[0].firstChild.textContent;
					}
					var errorSourceNode = xml.XPath.select({
						node : xmlDoc2,
						xpath : "//Message/Reply/Data/Errors/Error/Source"
					});
					if (errorSourceNode){
						objSubmitOrderResponse.errorSource = errorSourceNode[0].firstChild.textContent;
						var errorDescrNode = xml.XPath.select({
							node : xmlDoc2,
							xpath : "Message/Reply/Data/Errors/Error/Description"
						});
						if (errorDescrNode){
							objSubmitOrderResponse.errorDescription = errorDescrNode[0].firstChild.textContent;
						}
					}
	
				}		
			}
		}
		catch(e){	
			objSubmitOrderResponse.errorSource = "Unknown Error"
			objSubmitOrderResponse.errorDescription = 'SubmitOrderInformation call to Progressive Leasing Failed.  Error Message:' + e.message;
		}
		return objSubmitOrderResponse;	
	}
	
	function GetApproveID_ProgLeaseResp(str_responseBody){
		var arrApprovedResponse = new Array();
		var objApplicationResponse = new Object();
		try {		
			//parse response
			var xmlDoc = xml.Parser.fromString({
				text : str_responseBody
			});

			var resultNode = xml.XPath.select({
				node : xmlDoc,
				xpath : "//*[name()='ExecuteResult']"
			});
			if (resultNode && resultNode[0]){				
				var str_result = resultNode[0].firstChild.textContent;
				if (str_result){
					var xmlDoc2 = xml.Parser.fromString({
						text : str_result
					});
				}
				var statusNode = xml.XPath.select({
					node : xmlDoc2,
					xpath : "//Message/Reply/Status"
				});
				var str_status = "Failure";
				if (statusNode && statusNode[0]){
					str_status = statusNode[0].firstChild.textContent;
					objApplicationResponse.status = str_status;
				}				
				var sTagValue = str_status;
				if (str_status === 'Success') {
					var applicationsNode = xml.XPath.select({
						node : xmlDoc2,
						xpath : "//Message/Reply/Data/Applications/Application"
					});
					
					if (applicationsNode){
						sTagValue += " Application Length=" + applicationsNode.length;						
						for (var i = 0; i < applicationsNode.length; i++) {
							var objApplicatons = new Object();
							var sAccountNumber = applicationsNode[i].getElementsByTagName({
			                    tagName : 'AccountNumber'
			                })[0].textContent;			                
							
			                var sApplicationID = applicationsNode[i].getElementsByTagName({
			                    tagName : 'ApplicationID'
			                })[0].textContent;
			                
			                var fCreditLine = applicationsNode[i].getElementsByTagName({
			                    tagName : 'CreditLine'
			                })[0].textContent;
			                
			                sTagValue += "; AcctNum= " + sAccountNumber + ", sApplicationID=" + sApplicationID + ", fCreditLine=" + fCreditLine;			                         
			                objApplicationResponse.sTagValue = sTagValue;
			                
			                if (sAccountNumber){
			                	objApplicatons.sAccountNumber = sAccountNumber;
			                	objApplicationResponse.sAccountNumber = sAccountNumber;
			                }
			                if (sApplicationID){
			                	objApplicatons.sApplicationID = sApplicationID;
			                	objApplicationResponse.sApplicationID = sApplicationID;
			                }
			                if (fCreditLine){
			                	objApplicatons.fCreditLine = fCreditLine;
			                	objApplicationResponse.fCreditLine = fCreditLine;
			                }		
			                if (CreditPlanID){
			                	objApplicatons.CreditPlanID = CreditPlanID;
			                	objApplicationResponse.CreditPlanID = CreditPlanID;
			                }	
			                arrApprovedResponse.push(objApplicatons);
						}
					}	
					
				}		
				else {
					// Get Error Message					
					var errorStatusNode = xml.XPath.select({
						node : xmlDoc2,
						xpath : "//Message/Reply/Data/Errors/Error/Detail/ApplicationErrorCode"
					});					
					if (errorStatusNode && errorStatusNode[0]){
						objApplicationResponse.errorNumber = errorStatusNode[0].firstChild.textContent;
					}
					var errorDescriptionNode = xml.XPath.select({
						node : xmlDoc2,
						xpath : "//Message/Reply/Data/Errors/Error/Detail/ApplicationErrorMessage"
					});
					if (errorDescriptionNode && errorDescriptionNode[0]){
						objApplicationResponse.errorDescription = errorDescriptionNode[0].firstChild.textContent;
					}
					log.debug({
						title: "GetApproveID_ProgLeaseResp FAILURE",
						details: "Error Num: " + objApplicationResponse.errorNumber	+ ", errorDescription=" + objApplicationResponse.errorDescription
					});
				}				
			}
			objApplicationResponse.arrApprovals = arrApprovedResponse;
		}
		catch(e){	
			objApplicationResponse.errorSource = "Unknown Error NLS Router"
			objApplicationResponse.errorDescription = 'Lib_GetApproveID_ProgLeaseResp call to Financing for Progressive Leasing Failed.  Error Message:' + e.message;
		}
		return objApplicationResponse;
	}	

    return {
    	GetNLSRouterURL: GetNLSRouterURL,
    	BuildFinanceRequestXML : BuildFinanceRequestXML,
    	GetProgressiveLeasingURL: GetProgressiveLeasingURL,
    	setRequestNodeValue: setRequestNodeValue,
    	processReplyStatus: processReplyStatus,
    	PL_RequestStatusWithDeliveryConfirmation: PL_RequestStatusWithDeliveryConfirmation,
    	PL_ProcessRespStatusWithDeliveryConfirmation: PL_ProcessRespStatusWithDeliveryConfirmation,
    	PL_SubmitDeliveryConfirmation: PL_SubmitDeliveryConfirmation,
    	PL_ProcessSubmitDeliveryConfirmation: PL_ProcessSubmitDeliveryConfirmation,
    	GetApproveID_ProgLeaseResp: GetApproveID_ProgLeaseResp,
    	processProgLeaseResp_SubmitOrder: processProgLeaseResp_SubmitOrder  	
    };    
});
