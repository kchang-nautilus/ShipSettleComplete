/**
 * NLS Map Reduce Library functions for Error handling and write to Summary Report
 * Custom Record: NLS MapReduce Summary, ID = customrecord_nls_mr_summary
 * Author: KCHANG
 * Last Modified: 8/29/2017
 */
define(['N/email', 'N/error', 'N/format', 'N/record', 'N/runtime'],
/**
 * @param {email} email
 * @param {error} error
 * @param {format} format
 * @param {record} record
 * @param {runtime} runtime
 */
function(email, error, format, record, runtime) {
	var emailTo = 'kchang@nautilus.com';
	
	function handleErrorAndSendNotification(e, stage, gEmailTo)
    {
        log.error('handleErrorAndSendNotification Stage: ' + stage + ' failed', e);

        var author = -5;
        var recipients = emailTo;
        if (gEmailTo){
        	recipients += ("," + gEmailTo);
        }
        var subject = 'Map/Reduce script ' + runtime.getCurrentScript().id + ' failed for stage: ' + stage;
        var body = 'An error occurred with the following information:\n' +
                   'Error code: ' + e.name + '\n' +
                   'Error msg: ' + e.message;

        email.send({
            author: author,
            recipients: recipients,
            subject: subject,
            body: body
        });
    }

    function handleErrorIfAny(summary, sName, eMailTo)
    {
        var inputSummary = summary.inputSummary;
        var mapSummary = summary.mapSummary;
        var reduceSummary = summary.reduceSummary;
    	log.debug({
			title: 'handleErrorIfAny',
			details: 'summary.dateCreated: ' + summary.dateCreated
		});
        if (inputSummary.error)
        {
            var e = error.create({
                name: 'INPUT_STAGE_FAILED',
                message: inputSummary.error
            });
            handleErrorAndSendNotification(e, 'getInputData', eMailTo);
        }

        handleErrorInStage('Map', mapSummary, sName, eMailTo);
        handleErrorInStage('Reduce', reduceSummary, sName, eMailTo);
    }

    function handleErrorInStage(stage, summary, errorName, eMailTo)
    {
        var errorMsg = [];
        summary.errors.iterator().each(function(key, value){
            var msg = 'Failure on record key: ' + key + '. Error was: ' + JSON.parse(value).message + '. ';
            errorMsg.push(msg);
            return true;
        });
        if (errorMsg.length > 0)
        {
            var e = error.create({
                name: errorName,
                message: JSON.stringify(errorMsg)
            });
            handleErrorAndSendNotification(e, stage, eMailTo);
        }
    }

    function createSummaryRecord(summary, sName, scriptID)
    {
    	// Custom Record Name: NLS MapReduce Summary  Record ID: customrecord_nls_mr_summary
    	//*** Write the first 500 Errors
    	var maxOutput = 500;
        try
        {            
//        	log.debug({
//    			title: 'createSummaryRecord',
//    			details: 'summary.dateCreated: ' + summary.dateCreated + " summary.isRestarted: " + summary.isRestarted + ", mapSummary.dateCreated: " + summary.mapSummary.dateCreated
//    			+ ", reduceSummary.dateCreated: " + summary.reduceSummary.dateCreated
//    		});
        	//** Map Keys, record Counts in map stage 
            var mapKeys = 0;
            summary.mapSummary.keys.iterator().each(function (key)
            {
                mapKeys++;
                return true;
            });
            
        	//** REDUCE Oupput - Iterator that provides keys and values written as output during the reduce stage            
            var bUpdatedSO = '';
            var NotProcessed = '';
            var iUpdateCount = 0;
            var iErrorCount = 0;            
            var iLineCount = 0;
            
            //*** Output the first 500 records *** 
            summary.output.iterator().each(function(key, value) {
            	// objSummary: tranID, iCount, bShipComp, Error, arrItems            	
	            var objSummary = JSON.parse(value);
	            if (objSummary){
	                if (objSummary.Error) {
	                	iErrorCount++;
	                	if (iErrorCount < maxOutput && NotProcessed.length < 3800){
	                		NotProcessed += (iErrorCount + '. ' + objSummary.Error + " \n");
	                	}
	            	} else {
	            		if (objSummary.tranID){
	            			iUpdateCount++;
	            			// Reduce Key changed to CS or INV internal ID
	            			// The field custrecord_nls_mr_output contained more than the maximum number ( 4000 ) of characters allowed.
	            			if (bUpdatedSO.length < 3800){
		            			var z = iUpdateCount % 5;
		            			var sOutput = "c=" + objSummary.iCount;;
		            			if (objSummary.newID){
		            				if (objSummary.billType){
		            					sOutput = objSummary.billType + " Id=" + key;
		            				} else {
		            					sOutput = "Id=" + key;
		            				}
		            				
		            				z = iUpdateCount % 3;
		            			}
			            		if (objSummary.iCount && objSummary.iCount > 0){		            			
			            			iLineCount += parseInt(objSummary.iCount);
			            		}	            			
		            			var finalOP = objSummary.tranID + " " + sOutput;
		            			if (z === 0){
		            				finalOP += " \n";
		            			} else {
		            				finalOP += ", ";
		            			}
			            		bUpdatedSO += finalOP;	
	            			}
	            		}
	            	}
            	}
                return true;
            });    
            
            // Input Errors = custrecord_nls_mr_input_error
//            var iInputErrors = 0;
            var sInputError = summary.inputSummary.error;
//            if (sInputError){
//            	iInputErrors = 1;            	
//            }
            // Add iErrorCount
//            iErrorCount += iInputErrors;
            
            // Map errors?
            var mapErrors = '';
            var iMapErrors = 0;
            summary.mapSummary.errors.iterator().each(function (key, error)
            {
            	var objError = JSON.parse(error);
            	iMapErrors++;
            	//*** Write the first 500 Errors
            	if (iMapErrors < maxOutput){
	            	var sErrorMsg = '';
	            	if (objError){
	            		sErrorMsg = objError.message;
	            	}
	            	mapErrors += (iMapErrors + ". " + key + ' ' + sErrorMsg + ' \n');
	                log.error('Map Error for key: ' + key, error);
            	}
                return true;
            });            
            // Add iErrorCount
//            iErrorCount += iMapErrors;
            
            // Reduce Errors?
            var reduceErrors = '';
            var iReduceErrors = 0;
            summary.reduceSummary.errors.iterator().each(function (key, error)
            {
            	// {"type":"error.SuiteScriptError","name":"MapReduce - reduce","message":"An error occurred:\nError code: CC_PROCESSOR_ERROR\nError msg: Invalid account number. Possible action: Request a different card or other form of payment.","stack":["createError(N/error)"],"cause":{"name":"MapReduce - reduce","message":"An error occurred:\nError code: CC_PROCESSOR_ERROR\nError msg: Invalid account number. Possible action: Request a different card or other form of payment."},"id":"","notifyOff":false}
            	var objError = JSON.parse(error);
            	iReduceErrors++;
            	//*** Write the first 500 Errors
            	if (iReduceErrors < maxOutput){
	            	var sErrorMsg = '';
	            	if (objError){
	            		sErrorMsg = objError.message;
	            	}
	            	reduceErrors += (iReduceErrors + ". Key=" + key + ' ' + sErrorMsg + ' \n');
	                log.error('Reduce Error for key: ' + key, error);
            	}
                return true;
            });
            // Add iErrorCount
//            iErrorCount += iReduceErrors;
            
            log.audit({
        		title: 'mapReduce Summary',
        		details: "mapKeys=" + mapKeys + ", iUpdateCount=" + iUpdateCount + ", iErrorCount=" + iErrorCount + ", iLineCount=" + iLineCount + ", iMapErrors=" + iMapErrors + ", iReduceErrors=" + iReduceErrors
        	});
            //*** Create MR Summary Gap 181 
            var rec = record.create({
                type: 'customrecord_nls_mr_summary',
                isDynamic: true
            });
            var extDate = new Date(summary.dateCreated);
            //0 Name
            var iMonth = extDate.getMonth() + 1;
            // "SUM-181.2 " +
            sName = sName + iMonth + '/' + extDate.getDate() + '/' + extDate.getFullYear() + ' ' + extDate.getHours() + ':' + extDate.getMinutes() + ' ';            
            if (iErrorCount > 0 || iMapErrors > 0){
            	var iTotalErrors = iErrorCount + iMapErrors;	
            	sName += ('Errors=' + iTotalErrors);
            }
            rec.setValue({
                fieldId : 'name',
                value: sName
            });            
            // ScriptID: Script List/record
            rec.setValue({
                fieldId : 'custrecord_nls_mr_script',
                value: scriptID
            });   
            //1 MR Stage Seconds
            // Summary Stage seconds elapsed when running the map/reduce script.
            rec.setValue({
                fieldId: 'custrecord_nls_mr_stage_time',
                value: "Input=" + summary.inputSummary.seconds + ", Map=" + summary.mapSummary.seconds + ", Reduce=" + summary.reduceSummary.seconds + ", Summary=" + summary.seconds
            });
            // Calculate Total seconds elapsed when running the map/reduce script.
            var t0 = new Date(summary.dateCreated).getTime();			
			var t1 = new Date().getTime();
			var totalSeconds = parseInt((t1 - t0)/1000);
			//2. Total Seconds
            rec.setValue({
                fieldId: 'custrecord_nls_mr_total_time',
                value: totalSeconds
            });
            
            //3 Concurrency 
            rec.setValue({
                fieldId: 'custrecord_nls_mr_queues',
                value: summary.concurrency
            });
            //4 MR Usage
            rec.setValue({
                fieldId: 'custrecord_nls_mr_usage',
                value: summary.usage
            });
            //5 MR Yields
            rec.setValue({
                fieldId: 'custrecord_nls_mr_yields',
                value: summary.yields
            });
            //6 MR Exec Seconds
            rec.setValue({
                fieldId: 'custrecord_nls_mr_time',
                value: summary.seconds
            });
            //7. Map Keys Count, record Counts in map stage
            rec.setValue({
                fieldId: 'custrecord_nls_mr_map_keys',
                value: mapKeys
            });
            //***8. Processing time in second per records: MR Exec Seconds/Map Keys Count, record Counts in map stage devided by totl exection time
            if (mapKeys > 0 && totalSeconds > 0){
	            var recPerSec = (totalSeconds/mapKeys).toFixed(2);
	            rec.setValue({
	                fieldId: 'custrecord_nls_mr_secperrec',
	                value: recPerSec
	            });
            }
            //9. Script ID + Script Internal ID
            var objScript = runtime.getCurrentScript();
            rec.setValue({
                fieldId: 'custrecord_nls_mr_scriptid',
                value: objScript.id + " Id: " + scriptID
            });
            //8 Deployment ID
            var objScript = runtime.getCurrentScript();
            rec.setValue({
                fieldId: 'custrecord_nls_mr_deployid',
                value: objScript.deploymentId
            });
            //9 MR Output - SO processed successfully with item count
            rec.setValue({
                fieldId: 'custrecord_nls_mr_output',
                value: bUpdatedSO
            });
            //10 Not Processed with Error
            rec.setValue({
                fieldId: 'custrecord_nls_mr_not_processed',
                value: NotProcessed
            });                    
            
            //12 Count Records Processed
            rec.setValue({
            	fieldId: 'custrecord_nls_mr_rec_processed',
            	value: iUpdateCount
            });
            //13 Count Error Records
            rec.setValue({
            	fieldId: 'custrecord_nls_mr_error_rec',
            	value: iErrorCount
            });
            // Map error count: custrecord_nls_mr_map_errcount
            rec.setValue({
            	fieldId: 'custrecord_nls_mr_map_errcount',
            	value: iMapErrors
            });
            // Reduce Error Count: custrecord_nls_mr_reduce_errcount
            rec.setValue({
            	fieldId: 'custrecord_nls_mr_reduce_errcount',
            	value: iReduceErrors
            });
            //14 Line Count
            rec.setValue({
            	fieldId: 'custrecord_nls_mr_line_updated',
            	value: iLineCount
            });
            //15 Input Error : 	custrecord_nls_mr_input_error
            rec.setValue({
                fieldId: 'custrecord_nls_mr_input_error',
                value: sInputError
            });
            //16 Map Summary Errors            
            rec.setValue({
                fieldId: 'custrecord_nls_mr_map_errors',
                value: mapErrors
            });
            //17 Reduce Summary Errors
            rec.setValue({
                fieldId: 'custrecord_nls_mr_reduce_errors',
                value: reduceErrors
            });
            var oReport = rec.save();
            log.debug({
    			title: 'END createSummaryRecord',
    			details: 'Summary Report created: ' + oReport
    		});
        }
        catch(e)
        {
            handleErrorAndSendNotification(e, 'summarize');
        }
    }
    
    return {
    	handleErrorAndSendNotification: handleErrorAndSendNotification,
    	handleErrorIfAny: handleErrorIfAny,
    	handleErrorInStage: handleErrorInStage,
    	createSummaryRecord: createSummaryRecord
    };
    
});
