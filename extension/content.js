
// DARSCHYN - Educationalyar Extractor v3.3.6
if (window.__DARSCHYN_CONTENT_INITIALIZED__) {
    console.log("DARSCHYN content script already initialized.");
} else {
    window.__DARSCHYN_CONTENT_INITIALIZED__ = true;

    const EXTENSION_VERSION = "3.3.6";
    const EXPORT_SCHEMA_VERSION = "2.0";

    const runState = {
        status: 'PENDING',
        error: null,
        phase: 'INIT',
        stats: {
            requestsSent: 0,
            requestsSuccessful: 0,
            requestsFailed: 0,
            pagesProcessed: 0,
            batchesTotal: 0,
            batchesCompletedWithRows: 0,
            batchesCompletedEmpty: 0,
            batchesFailed: 0,
            batchesLimitExceeded: 0,
            batchesPaginationUnresolved: 0,
            batchesUnresolved: 0,
            rawRows: 0,
            uniqueClasses: 0,
            uniqueCourses: 0,
            duplicatesRemoved: 0
        },
        term: 'UNKNOWN',
        startedAt: null,
        durationMs: 0,
        anomalies: [],
        debug: {
            network: [],
            coverageStatus: 'UNKNOWN',
            identity: { strong: 0, compositeStrong: 0, compositeWeak: 0, ambiguous: 0, dropped: 0, merged: 0 },
            pagination: { detected: 0, unresolved: 0, loops: 0, maxPagesHit: 0 },
            tableDetection: { calls: 0, winningTableFound: false },
            parser: { rowsSeen: 0, validRows: 0, malformedRows: 0, malformedSamples: [] },
            classification: { searchPage: 0, limitExceeded: 0, renderable: 0, empty: 0, unknown: 0 }
        }
    };

    let recordsMap = new Map();
    let courseRegistry = new Map();
    let abortController = null;

    function notifyUI() {
        try { chrome.runtime.sendMessage({ type: 'STATE_UPDATE', state: runState }); } catch (e) { /* expected if popup closed */ }
    }

    function logAnomaly(type, data) {
        if (runState.anomalies.length < 10) {
            runState.anomalies.push({ type, timestamp: new Date().toISOString(), ...data });
        }
    }

    const TermResolver = {
        detect(doc) {
            let text = doc.body.innerText || '';
            let termMatch = text.match(/تـرم\s*تحصيلي\s*:\s*(\d{3,5})/);
            if (termMatch) return termMatch[1];
            let navMatch = text.match(/نیمسال\s*(\d{3,5})/);
            if (navMatch) return navMatch[1];
            return 'UNKNOWN';
        }
    };

    
    const ScheduleParser = {
        parse(text) {
            if (!text) return { raw: '', parsedDay: '', parsedStart: '', parsedEnd: '' };
            let parsedDay = '';
            let parsedStart = '';
            let parsedEnd = '';
            const days = ['چهارشنبه', 'پنجشنبه', 'يكشنبه', 'يکشنبه', 'دوشنبه', 'سه شنبه', 'جمعه', 'شنبه'];
            for (let d of days) {
                if (text.includes(d)) {
                    parsedDay = d;
                    break;
                }
            }
            let timeMatch = text.match(/(d{1,2}:d{2})s*-s*(d{1,2}:d{2})/);
            if (timeMatch) {
                parsedStart = timeMatch[1];
                parsedEnd = timeMatch[2];
            }
            return {
                raw: text.trim(),
                parsedDay,
                parsedStart,
                parsedEnd
            };
        }
    };

    const IdentityResolver = {
        resolve(rawRecord) {
            const cc = rawRecord.courseClass;
            const c = rawRecord.course;
            
            if (cc.courseClassRef && cc.courseClassRef !== 'UNKNOWN' && cc.courseClassRef.length > 3) {
                runState.debug.identity.strong++;
                return { type: 'STRONG', key: "REF_" + cc.courseClassRef };
            }
            let ccode = c.courseCode || '';
            let ocode = cc.offeringCode || '';
            let group = cc.group || '';
            if (ccode && ocode) {
                runState.debug.identity.compositeStrong++;
                return { type: 'COMPOSITE_STRONG', key: "SEC_" + ccode + "_" + ocode };
            }
            let sched = cc.schedule || '';
            let inst = cc.instructor || '';
            if (ccode) {
                runState.debug.identity.compositeWeak++;
                return { type: 'COMPOSITE_WEAK', key: "TER_" + ccode + "_" + group + "_" + inst + "_" + sched };
            }
            runState.debug.identity.ambiguous++;
            return { type: 'AMBIGUOUS', key: "AMB_" + Date.now() + "_" + Math.random() };
        }
    };

    const DedupEngine = {
        add(rawRecord) {
            runState.stats.rawRows++;
            let identity = IdentityResolver.resolve(rawRecord);
            rawRecord._meta.identityType = identity.type;
            rawRecord._meta.identityKey = identity.key;

            if (identity.type === 'AMBIGUOUS') {
                recordsMap.set(identity.key, rawRecord);
                this.registerCourse(rawRecord);
                runState.stats.uniqueClasses++;
                return 'ADDED_AMBIGUOUS';
            }

            if (recordsMap.has(identity.key)) {
                let existing = recordsMap.get(identity.key);
                let isDistinct = false;
                if (existing.courseClass.offeringCode && rawRecord.courseClass.offeringCode && existing.courseClass.offeringCode !== rawRecord.courseClass.offeringCode) isDistinct = true;
                if (existing.courseClass.courseClassRef && rawRecord.courseClass.courseClassRef && existing.courseClass.courseClassRef !== rawRecord.courseClass.courseClassRef) isDistinct = true;

                if (isDistinct) {
                    let newKey = identity.key + "_DISTINCT_" + Date.now();
                    recordsMap.set(newKey, rawRecord);
                    this.registerCourse(rawRecord);
                    runState.stats.uniqueClasses++;
                    return 'KEPT_DISTINCT';
                }

                runState.stats.duplicatesRemoved++;
                runState.debug.identity.dropped++;
                
                return 'EXACT_DUPLICATE';
            } else {
                recordsMap.set(identity.key, rawRecord);
                this.registerCourse(rawRecord);
                runState.stats.uniqueClasses++;
                return 'ADDED';
            }
        },
        registerCourse(rawRecord) {
            let ccode = rawRecord.course.courseCode;
            if (ccode && !courseRegistry.has(ccode)) {
                courseRegistry.set(ccode, true);
                runState.stats.uniqueCourses++;
            }
        }
    };

            const PaginationEngine = {
        discover(doc, bestTable) {
            let result = { 
                found: false, 
                mechanism: 'UNKNOWN', 
                currentPage: 1, 
                nextPage: null, 
                hasNext: false, 
                parameters: {}, 
                diagnostic: null 
            };

            let scripts = Array.from(doc.querySelectorAll('script')).map(s => s.innerHTML).join('\n');
            let analysis = {
                gotoPageNew: null,
                gotoFormCmd: null,
                pageField: 'parameter(pageNumber)',
                commandField: null,
                commandValue: null,
                formIdOrName: null
            };

            
            let gpnMatch = scripts.match(/function\s+gotoPageNew\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
            if (gpnMatch) {
                analysis.gotoPageNew = gpnMatch[0].replace(/([A-Z0-9]{20,})/gi, 'MASKED');
                
                let pMatch = gpnMatch[1].match(/\.elements\[['"]([^'"]+)['"]\]\.value\s*=/);
                if (!pMatch) pMatch = gpnMatch[1].match(/\.([a-zA-Z0-9_]+)\.value\s*=/);
                if (pMatch) analysis.pageField = pMatch[1];

                let submitMatch = gpnMatch[1].match(/document\.(getElementById\(['"]([^'"]+)['"]\)|forms\[([^\\]]+)\]|([a-zA-Z0-9_]+))\.(submit|gotoFormCmd)/);
                if (submitMatch) {
                    analysis.formIdOrName = submitMatch[2] || submitMatch[3] || submitMatch[4];
                }
                
                let gfcCall = gpnMatch[1].match(/gotoFormCmd\s*\(\s*['"]?([^)'"]+)['"]?\s*\)/);
                if (gfcCall) {
                    analysis.commandValue = gfcCall[1];
                } else {
                    let cmdValMatch = gpnMatch[1].match(/\.elements\[['"]([^'"]+)['"]\]\.value\s*=\s*['"]([^'"]+)['"]/);
                    if (!cmdValMatch) cmdValMatch = gpnMatch[1].match(/\.([a-zA-Z0-9_]+)\.value\s*=\s*['"]([^'"]+)['"]/);
                    if (cmdValMatch) {
                        if (cmdValMatch[1] !== analysis.pageField) {
                            analysis.commandField = cmdValMatch[1];
                            analysis.commandValue = cmdValMatch[2];
                        }
                    }
                }
            }

            let gfcMatch = scripts.match(/function\s+gotoFormCmd\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
            if (gfcMatch) {
                analysis.gotoFormCmd = gfcMatch[0].replace(/([A-Z0-9]{20,})/gi, 'MASKED');
                
                let cmdAssign = gfcMatch[1].match(/\.elements\[['"]([^'"]+)['"]\]\.value\s*=/);
                if (!cmdAssign) cmdAssign = gfcMatch[1].match(/\.([a-zA-Z0-9_]+)\.value\s*=/);
                if (cmdAssign) analysis.commandField = cmdAssign[1];
                
                if (!analysis.formIdOrName) {
                    let submitMatch = gfcMatch[1].match(/document\.(getElementById\(['"]([^'"]+)['"]\)|forms\[([^\]]+)\]|([a-zA-Z0-9_]+))\.submit/);
                    if (submitMatch) analysis.formIdOrName = submitMatch[2] || submitMatch[3] || submitMatch[4];
                }
            }
            let targetForm = extractResultForm(doc, bestTable);
            if (analysis.formIdOrName) {
                let identifier = analysis.formIdOrName.replace(/['"]/g, '');
                let specificForm = doc.getElementById(identifier) || doc.forms[identifier];
                if (specificForm) targetForm = specificForm;
            }

            
            if (targetForm && !analysis.commandField) {
                if (targetForm.querySelector('input[name="command"]')) analysis.commandField = 'command';
                else if (targetForm.querySelector('input[name="parameter(command)"]')) analysis.commandField = 'parameter(command)';
            }
            if (targetForm) {
                let pField = targetForm.querySelector("input[name='" + analysis.pageField + "']");
                if (pField && pField.value) {
                    let p = parseInt(pField.value, 10);
                    if (!isNaN(p)) result.currentPage = p;
                } else {
                    let text = doc.body.innerText || '';
                    let pageMatch = text.match(/صفحه\s*(\d+)\s*از\s*(\d+)/) || text.match(/Page\s*(\d+)\s*of\s*(\d+)/i);
                    if (pageMatch) {
                        result.currentPage = parseInt(pageMatch[1], 10);
                        let totalPages = parseInt(pageMatch[2], 10);
                        if (result.currentPage < totalPages) result.hasNext = true;
                    }
                }

                let clickables = Array.from(doc.querySelectorAll('a, button, input, img, [onclick]'));
                for (let el of clickables) {
                    let onclick = el.getAttribute('onclick') || '';
                    if (onclick.includes('gotoPageNew')) {
                        let match = onclick.match(/gotoPageNew\s*\(\s*['"]?([^)'"]+)['"]?\s*\)/i);
                        if (match) {
                            let arg = match[1].trim();
                            let targetPage = null;
                            if (arg === '+1' || arg === '+ 1' || arg.toLowerCase() === 'next') targetPage = result.currentPage + 1;
                            else if (!isNaN(parseInt(arg, 10))) {
                                targetPage = parseInt(arg, 10);
                                if (targetPage === 1 && arg === '+1') targetPage = result.currentPage + 1;
                            }
                            
                            if (targetPage !== null && targetPage > result.currentPage) {
                                result.found = true; 
                                result.hasNext = true; 
                                result.nextPage = targetPage;
                                result.mechanism = 'FORM_COMMAND_DYNAMIC';
                                result.parameters[analysis.pageField] = targetPage;
                                
                                if (analysis.commandField && analysis.commandValue) {
                                    result.parameters[analysis.commandField] = analysis.commandValue;
                                } else if (onclick.includes('gotoFormCmd')) {
                                    let cmdMatch = onclick.match(/gotoFormCmd\s*\(\s*['"]?([^)'"]+)['"]?\s*\)/i);
                                    if (cmdMatch && analysis.commandField) {
                                        result.parameters[analysis.commandField] = cmdMatch[1];
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
                
                let reqSig = {
                    method: targetForm.method || 'POST',
                    action: targetForm.getAttribute('action') || '',
                    fields: Array.from(targetForm.querySelectorAll('input[type="hidden"]')).map(i => i.name)
                };

                result.diagnostic = {
                    mechanism: result.mechanism,
                    functionFound: !!analysis.gotoPageNew,
                    gotoPageNew: analysis.gotoPageNew,
                    gotoFormCmd: analysis.gotoFormCmd,
                    form: {
                        id: targetForm.id,
                        name: targetForm.name,
                        action: reqSig.action,
                        method: reqSig.method
                    },
                    paginationState: {
                        current: result.currentPage,
                        next: result.nextPage
                    },
                    requestSignature: reqSig,
                    resolved: result.found,
                    extractedField: analysis.pageField
                };
                
                result.targetForm = targetForm;
            }

            return result;
        },
        buildSignature(batchId, pageNumber) { return "B" + batchId + "_P" + pageNumber; },
        buildResponseSignature(doc, bestTable) {
            if (!bestTable) return "EMPTY";
            let rows = Array.from(bestTable.querySelectorAll('tr'));
            let firstDataRow = rows.length > 1 ? rows[1] : rows[0];
            let rowText = firstDataRow ? firstDataRow.innerText.replace(/\s+/g, ' ').trim() : "EMPTY";
            let text = doc.body.innerText || '';
            let pageMatch = text.match(/صفحه\s*(\d+)\s*از\s*(\d+)/) || text.match(/Page\s*(\d+)\s*of\s*(\d+)/i);
            return (pageMatch ? pageMatch[0] : "") + " | " + rowText;
        }
    };

    const CoverageEngine = {
        evaluate() {
            if (runState.stats.batchesFailed > 0) return 'FAILED';
            if (runState.stats.batchesPaginationUnresolved > 0 || runState.stats.batchesLimitExceeded > 0 || runState.stats.batchesUnresolved > 0) return 'PARTIAL';
            if (runState.stats.batchesCompletedWithRows === 0 && runState.stats.batchesCompletedEmpty === 0) return 'FAILED';
            return 'COMPLETE';
        }
    };

    const QueryPlanner = {
        discoverDimensions(form) {
            let dimensions = [];
            let selects = Array.from(form.querySelectorAll('select'));
            for (let select of selects) {
                if (select.name && select.name.includes('orderBy')) continue;
                if (select.name && select.name.includes('sort')) continue;
                let opts = Array.from(select.querySelectorAll('option')).filter(o => o.value && o.value.trim() !== '');
                if (opts.length > 1) { 
                    dimensions.push({ name: select.name, label: select.title || select.name, options: opts.map(o => ({ value: o.value, text: o.innerText })) });
                }
            }
            return dimensions.sort((a,b) => b.options.length - a.options.length);
        }
    };
function findBestResultTable(doc) {
        let tables = Array.from(doc.querySelectorAll('table'));
        let bestTable = null;
        let bestScore = -1;
        let debugObj = { tableFound: false, tableIndex: -1, headerScore: 0, dataRowCount: 0, nestedDepth: 0, reason: "NO_TABLES", candidates: [] };

        for (let i = 0; i < tables.length; i++) {
            let table = tables[i];
            let rows = Array.from(table.rows); // Only direct rows of THIS table
            
            let candidateDebug = { index: i, rows: rows.length, score: 0, reason: "REJECTED", isNested: false };

            let depth = 0;
            let p = table.parentElement;
            while (p) {
                if (p.tagName === 'TABLE') { depth++; candidateDebug.isNested = true; }
                p = p.parentElement;
            }

            if (rows.length < 1) {
                candidateDebug.reason = "NO_ROWS";
                debugObj.candidates.push(candidateDebug);
                continue;
            }
            
            let headerScore = 0;
            let headerRowIndex = -1;
            let firstHeaderLikeTexts = "";
            
            for (let j = 0; j < Math.min(10, rows.length); j++) {
                let row = rows[j];
                
                // If row contains inputs, it's likely a search form header, not a result table
                if (row.querySelector('input[type="text"], select')) continue;
                
                let cells = Array.from(row.cells);
                let rowText = cells.map(c => (c.innerText || c.textContent || "").trim()).join(" ");
                
                let score = 0;
                if (rowText.includes('کد درس')) score += 3;
                if (rowText.includes('نام درس')) score += 3;
                if (rowText.includes('کد ارائه') || rowText.includes('مشخصه') || rowText.includes('كد ارائه')) score += 2;
                if (rowText.includes('زمانبندی') || rowText.includes('زمان برگزاری') || rowText.includes('زمانبندي')) score += 2;
                if (rowText.includes('استاد') || rowText.includes('اساتید')) score += 2;
                if (rowText.includes('گروه آموزشی')) score += 1;
                if (rowText.includes('دانشکده')) score += 1;
                if (rowText.includes('مقطع')) score += 1;
                if (rowText.includes('ظرفیت') || rowText.includes('ظرفيت')) score += 1;
                if (rowText.includes('امتحان')) score += 1;
                
                if (score > headerScore) {
                    headerScore = score;
                    headerRowIndex = j;
                    firstHeaderLikeTexts = rowText.substring(0, 100);
                }
            }

            candidateDebug.score = headerScore;
            candidateDebug.firstHeaderLikeTexts = firstHeaderLikeTexts;
            let dataRows = headerRowIndex !== -1 ? rows.length - (headerRowIndex + 1) : 0;
            candidateDebug.dataRows = dataRows;
            candidateDebug.depth = depth;

            if (headerScore >= 5) {
                if (headerScore > bestScore || 
                   (headerScore === bestScore && dataRows > debugObj.dataRowCount) || 
                   (headerScore === bestScore && dataRows === debugObj.dataRowCount && depth > debugObj.nestedDepth)) {
                    
                    bestScore = headerScore;
                    bestTable = table;
                    debugObj.tableFound = true;
                    debugObj.tableIndex = i;
                    debugObj.headerScore = headerScore;
                    debugObj.dataRowCount = dataRows;
                    debugObj.nestedDepth = depth;
                    debugObj.reason = "VALID_RESULT_TABLE";
                    candidateDebug.reason = "WINNER";
                } else {
                    candidateDebug.reason = "OUTSCORED";
                }
            } else {
                candidateDebug.reason = "LOW_SCORE";
            }
            debugObj.candidates.push(candidateDebug);
        }
        
        // reset previous winners
        debugObj.candidates.forEach(c => {
            if (c.reason === "WINNER" && c.index !== debugObj.tableIndex) c.reason = "OUTSCORED";
        });

        if (bestTable) {
            bestTable.__darschyn_debug = debugObj;
        } else {
            doc.__darschyn_debug = debugObj;
        }
        return bestTable;
    }
    
function extractRowsFromDoc(doc, currentTerm, batchId) {
        let results = [];
        let debug = runState.debug;
        
        if (!debug.tableDetection) debug.tableDetection = { calls: 0, winningTableFound: false };
        if (!debug.parser) debug.parser = { rowsSeen: 0, validRows: 0, malformedRows: 0, malformedSamples: [] };
        if (!debug.warnings) debug.warnings = [];

        
        runState.debug.tableDetection.calls++; 
        let bestTable = findBestResultTable(doc); 
        
        let tableDebug = bestTable ? bestTable.__darschyn_debug : doc.__darschyn_debug;
        
        if (bestTable) {
            runState.debug.tableDetection.winningTableFound = true;
        }
        
        // Diagnostic Log for specific batch
        if (batchId === 'root' || (batchId && batchId.includes('27'))) {
            let rawHtml = doc.documentElement ? doc.documentElement.innerHTML : '';
            debug.warnings.push(`DIAG[${batchId}] size=${rawHtml.length}, tables=${doc.querySelectorAll('table').length}, trs=${doc.querySelectorAll('tr').length}, tds=${doc.querySelectorAll('td, th').length}`);
            
            let candStr = (tableDebug && tableDebug.candidates) ? tableDebug.candidates.map(c => `T[${c.index}] score=${c.score} rows=${c.rows} reason=${c.reason} nested=${c.isNested}`).join(' | ') : 'No candidates';
            debug.warnings.push(`DIAG[${batchId}] candidates: ` + candStr);
            
            if (bestTable) {
                let snippet = bestTable.outerHTML ? bestTable.outerHTML.substring(0, 400) : (bestTable.innerHTML || '').substring(0, 400);
                debug.warnings.push(`DIAG[${batchId}] winning table snippet: ` + snippet);
            }
        }

        if (!bestTable) {
            debug.warnings.push(`extractRowsFromDoc [${batchId}]: No valid result table found.`);
            if (doc.__darschyn_netLog) {
                doc.__darschyn_netLog.resultState = 'TABLE_NOT_FOUND';
            }
            return results;
        }

        let rows = Array.from(bestTable.rows);

        let headerRowIndex = rows.findIndex(r => {
            if (!r.cells) return false;
            let cells = Array.from(r.cells);
            let text = cells.map(c => (c.innerText || c.textContent || '').trim()).join(" ");
            return (text.includes('نام درس') || text.includes('کد درس')) && (text.includes('مشخصه') || text.includes('كد ارائه'));
        });
        
        if (headerRowIndex === -1) {
             headerRowIndex = rows.findIndex(r => {
                if (!r.cells) return false;
                let text = r.innerText || r.textContent || '';
                return text.includes('نام درس') || text.includes('کد درس');
            });
        }
        
        if (doc.__darschyn_netLog) {
            doc.__darschyn_netLog.rowsFound = headerRowIndex !== -1 ? Math.max(0, rows.length - (headerRowIndex + 1)) : 0;
        }

        if (headerRowIndex === -1) {
            debug.warnings.push(`extractRowsFromDoc [${batchId}]: Could not find header row in the table.`);
            if (doc.__darschyn_netLog) {
                doc.__darschyn_netLog.resultState = 'TABLE_FOUND_BUT_ROWS_UNPARSED';
            }
            return results;
        }

        let headCells = Array.from(rows[headerRowIndex].cells || []).map(c => (c.innerText || c.textContent || '').trim());
        let colMap = {
            courseCode: headCells.findIndex(h => h.includes('کد درس')),
            courseName: headCells.findIndex(h => h.includes('نام درس')),
            offeringCode: headCells.findIndex(h => h.includes('مشخصه') || h.includes('كد ارائه')),
            instructor: headCells.findIndex(h => h.includes('استاد') || h.includes('اساتید')),
            schedule: headCells.findIndex(h => h.includes('زمان برگزاری') || h.includes('زمانبندي')),
            exam: headCells.findIndex(h => h.includes('امتحان')),
            capacity: headCells.findIndex(h => h.includes('ظرفیت') || h.includes('ظرفيت')),
            degree: headCells.findIndex(h => h.includes('مقطع')),
            faculty: headCells.findIndex(h => h.includes('دانشکده'))
        };

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            let row = rows[i];
            let cells = row.cells;
            if (!cells) continue;
            
            debug.parser.rowsSeen++;
            
            if (cells.length < 5) {
                debug.parser.malformedRows++;
                continue;
            }
            
            let getText = (idx) => (idx >= 0 && cells[idx]) ? (cells[idx].innerText || cells[idx].textContent || '').trim() : '';
            
            let scheduleData = ScheduleParser.parse(getText(colMap.schedule));
            
            let refMatch = row.innerHTML.match(/name="[^"]*(?:Ref|Id)[^"]*"[^>]*value="([^"]+)"/i) || row.innerHTML.match(/value="([^"]+)"/i);
            let refId = refMatch ? refMatch[1] : null;

            let rec = {
                refId: refId,
                term: currentTerm,
                courseCode: getText(colMap.courseCode),
                courseName: getText(colMap.courseName),
                offeringCode: getText(colMap.offeringCode),
                instructor: getText(colMap.instructor),
                schedule: scheduleData.raw,
                parsedScheduleDay: scheduleData.parsedDay,
                parsedScheduleStart: scheduleData.parsedStart,
                parsedScheduleEnd: scheduleData.parsedEnd,
                exam: getText(colMap.exam),
                capacity: getText(colMap.capacity),
                degree: getText(colMap.degree),
                faculty: getText(colMap.faculty)
            };

            if (!rec.courseCode && !rec.courseName) {
                debug.parser.malformedRows++;
                if (debug.parser.malformedSamples.length < 10) {
                    debug.parser.malformedSamples.push({ rowIndex: i, reason: 'Missing core codes' });
                }
                continue;
            }
            
            debug.parser.validRows++;
            results.push(rec);
        }

        if (doc.__darschyn_netLog) {
            doc.__darschyn_netLog.validRows = results.length;
            if (results.length > 0) {
                doc.__darschyn_netLog.resultState = 'RENDERABLE_WITH_ROWS';
            } else if (doc.__darschyn_netLog.rowsFound > 0) {
                doc.__darschyn_netLog.resultState = 'ROWS_FOUND_PARSE_FAILED';
            } else {
                doc.__darschyn_netLog.resultState = 'TABLE_FOUND_EMPTY';
            }
        }

        return results;
    }

    // --- Message Listener ---
    
    function parseAndAdaptRows(doc, term, batchId, pageNum) {
        let oldFormatRows = extractRowsFromDoc(doc, term, batchId);
        let rawRecords = [];
        for (let r of oldFormatRows) {
            let raw = {
                course: { courseCode: r.courseCode, courseName: r.courseName, courseType: r.courseType, units: r.unit },
                courseClass: { courseClassRef: r.refId, offeringCode: r.offeringCode, group: r.group, instructor: r.instructor, schedule: r.schedule, capacity: r.capacity, exam: r.exam, degree: r.degree, unit: r.unit },
                _meta: { sourceBatchId: batchId, sourcePage: pageNum, extractedAt: new Date().toISOString(), parserVersion: EXTENSION_VERSION }
            };
            rawRecords.push(raw);
        }
        return rawRecords;
    }

    function analyzeResponseState(doc, source) {
        let text = doc.body.innerText || '';
        let bestTable = findBestResultTable(doc);

        if (text.includes('نشست شما خاتمه یافته') || text.includes('Session expired')) {
            return 'SESSION_EXPIRED';
        }
        
        if (text.includes('بیش از 1000') || (text.includes('بیش از') && text.includes('رکورد'))) {
            runState.debug.classification.limitExceeded++;
            return 'RESULT_LIMIT_EXCEEDED';
        }
        
        if (bestTable) {
            let trs = Array.from(bestTable.querySelectorAll('tr'));
            if (trs.length >= 2) {
                runState.debug.classification.renderable++;
                return source === 'PAGINATION' ? 'PAGINATION_RESULT' : 'RENDERABLE';
            } else {
                runState.debug.classification.empty++;
                return 'NO_RESULTS';
            }
        }
        
        if (text.includes('هیچ رکوردی یافت نشد') || text.includes('داده ای جهت نمایش وجود ندارد')) {
            runState.debug.classification.empty++;
            return 'NO_RESULTS';
        }
        
        if (doc.querySelector('form[name="itoForm"]') || doc.getElementById('findForm')) {
            runState.debug.classification.searchPage++;
            return 'SEARCH_PAGE';
        }

        runState.debug.classification.unknown++;
        if (source === 'PAGINATION') {
            let forms = Array.from(doc.querySelectorAll('form')).map(f => ({
                id: f.id, name: f.name, action: f.getAttribute('action'),
                inputs: Array.from(f.querySelectorAll('input')).map(i => i.name).slice(0, 5)
            }));
            let tablesCount = doc.querySelectorAll('table').length;
            let textSample = text.replace(/\s+/g, ' ').substring(0, 200);
            
            if (!runState.anomalies.some(a => a.type === 'PAGINATION_UNKNOWN_RESPONSE' && a.batchId === runState.currentBatchId)) {
                logAnomaly('PAGINATION_UNKNOWN_RESPONSE', {
                    batchId: runState.currentBatchId || 'unknown',
                    classifierState: 'UNKNOWN',
                    reason: 'Server returned a page that did not match RENDERABLE, NO_RESULTS, EXPIRED, etc.',
                    forms,
                    tablesCount,
                    textSample
                });
            }
        }
        return 'UNKNOWN';
    }
    
    function extractResultForm(doc, bestTable) {
        if (bestTable) {
            let p = bestTable.parentElement;
            while (p) {
                if (p.tagName === 'FORM') return p;
                p = p.parentElement;
            }
        }
        return doc.getElementById('findForm') || doc.querySelector('form[name="itoForm"]') || doc.getElementById('resultsForm') || doc.querySelector('form');
    }

    const ExtractionEngine = {
        async executeRequest(url, formData, batchId, pageNum) {
            if (abortController.signal.aborted) return null;
            runState.stats.requestsSent++;
            let startTime = performance.now();
            try {
                let res = await fetch(url, { method: 'POST', body: new URLSearchParams(formData), signal: abortController.signal });
                let html = await res.text();
                runState.stats.requestsSuccessful++;
                runState.debug.network.push({ batchId, pageNum, dur: Math.round(performance.now() - startTime), size: html.length, status: res.status });
                return new DOMParser().parseFromString(html, 'text/html');
            } catch (err) {
                if (!abortController.signal.aborted) {
                    runState.stats.requestsFailed++;
                    logAnomaly('NETWORK_FAILURE', { batchId, pageNum, error: err.message });
                }
                return null;
            }
        },

        async paginateBatch(initialDoc, batchId) {
            let currentDoc = initialDoc;
            let currentPage = 1;
            let visitedSignatures = new Set();
            let visitedResponseSignatures = new Set();
            let totalExtracted = 0;

            let firstResponseSig = PaginationEngine.buildResponseSignature(initialDoc, findBestResultTable(initialDoc));
            visitedResponseSignatures.add(firstResponseSig);

            while (true) {
                if (abortController.signal.aborted) break;

                let rawRecords = parseAndAdaptRows(currentDoc, runState.term, batchId, currentPage);
                totalExtracted += rawRecords.length;

                for (let rr of rawRecords) DedupEngine.add(rr);
                
                if (rawRecords.length > 0) runState.stats.pagesProcessed++;
                notifyUI();

                let bestTable = findBestResultTable(currentDoc);
                let pagInfo = PaginationEngine.discover(currentDoc, bestTable);
                
                if (currentPage === 1) {
                    if (pagInfo.found) runState.debug.pagination.detected++;
                    else if (rawRecords.length >= 10) {
                        runState.stats.batchesPaginationUnresolved++;
                        runState.debug.pagination.unresolved++;
                        logAnomaly('PAGINATION_UNRESOLVED', { batchId, rows: rawRecords.length, diagnostic: pagInfo.diagnostic });
                    }
                }
                
                if (!pagInfo.found || !pagInfo.hasNext) break;

                let sig = PaginationEngine.buildSignature(batchId, pagInfo.nextPage);
                if (visitedSignatures.has(sig)) {
                    runState.debug.pagination.loops++;
                    logAnomaly('LOOP_DETECTED', { batchId, page: pagInfo.nextPage });
                    break;
                }
                visitedSignatures.add(sig);

                if (currentPage >= 100) {
                    runState.debug.pagination.maxPagesHit++;
                    logAnomaly('MAX_PAGES_HIT', { batchId });
                    break;
                }

                let targetForm = pagInfo.targetForm || extractResultForm(currentDoc, bestTable);
                if (!targetForm) break;

                let fd = new FormData(targetForm);
                for (let k in pagInfo.parameters) fd.set(k, pagInfo.parameters[k]);

                let actionUrl = targetForm.getAttribute('action');
                if (!actionUrl) actionUrl = window.location.pathname + window.location.search;
                let nextDoc = await this.executeRequest(actionUrl, fd, batchId, pagInfo.nextPage);
                
                if (!nextDoc) break;
                
                let state = analyzeResponseState(nextDoc, 'PAGINATION');
                if (state !== 'RENDERABLE' && state !== 'PAGINATION_RESULT' && state !== 'NO_RESULTS') break;

                let responseSig = PaginationEngine.buildResponseSignature(nextDoc, findBestResultTable(nextDoc));
                if (visitedResponseSignatures.has(responseSig)) {
                    runState.debug.pagination.loops++;
                    logAnomaly('LOOP_DETECTED_RESPONSE_SIG', { batchId, page: pagInfo.nextPage, sig: responseSig });
                    break;
                }
                visitedResponseSignatures.add(responseSig);

                currentDoc = nextDoc;
                currentPage = pagInfo.nextPage;
            }
            return totalExtracted;
        },

        async processBatchNode(form, dimensions, currentFilters, parentBatchId) {
            if (abortController.signal.aborted) return;
            
            if (dimensions.length === 0) {
                runState.stats.batchesUnresolved++;
                logAnomaly('UNRESOLVED_LEAF_NODE', { batchId: parentBatchId });
                return;
            }

            let dim = dimensions[0];
            let nextDimensions = dimensions.slice(1);
            runState.stats.batchesTotal += dim.options.length;
            notifyUI();

            for (let i = 0; i < dim.options.length; i++) {
                if (abortController.signal.aborted) return;
                let opt = dim.options[i];
                let batchId = parentBatchId + "_" + i;
                
                let filters = [...currentFilters, { name: dim.name, value: opt.value }];
                let fd = new FormData(form);
                if (fd.has('parameter(pageNumber)')) fd.set('parameter(pageNumber)', '1');
                if (fd.has('movement')) fd.delete('movement');
                filters.forEach(f => fd.set(f.name, f.value));

                let actionUrl = form.getAttribute('action'); if (!actionUrl) actionUrl = window.location.pathname + window.location.search;
                let resDoc = await this.executeRequest(actionUrl, fd, batchId, 1);
                
                if (!resDoc) {
                    runState.stats.batchesFailed++;
                    continue;
                }

                let state = analyzeResponseState(resDoc, 'BATCH_POST');

                if (state === 'RESULT_LIMIT_EXCEEDED') {
                    runState.stats.batchesLimitExceeded++;
                    await this.processBatchNode(form, nextDimensions, filters, batchId);
                } else if (state === 'RENDERABLE') {
                    let totalExtracted = await this.paginateBatch(resDoc, batchId);
                    if (totalExtracted === 0) {
                        let rowsCount = resDoc.querySelectorAll('table tr').length;
                        if (rowsCount > 2) {
                            runState.stats.batchesFailed++;
                            logAnomaly('PARSE_FAILED', { batchId });
                        } else {
                            runState.stats.batchesCompletedEmpty++;
                        }
                    } else {
                        runState.stats.batchesCompletedWithRows++;
                    }
                } else if (state === 'NO_RESULTS') {
                    runState.stats.batchesCompletedEmpty++;
                } else {
                    runState.stats.batchesUnresolved++;
                    logAnomaly('CLASSIFICATION_REGRESSION', { batchId, actual: state });
                }
                notifyUI();
            }
        },

        async startExtraction() {
            abortController = new AbortController();
            runState.startedAt = performance.now();
            runState.status = 'PROCESSING';
            runState.phase = 'PAGE_DETECTED';
            runState.term = TermResolver.detect(document);
            notifyUI();

            try {
                let state = analyzeResponseState(document, 'INITIAL_PAGE');
                let workingDoc = document;

                if (state === 'SESSION_EXPIRED') throw new Error("سشن شما منقضی شده است. لطفا مجددا وارد آموزشیار شوید.");

                if (state === 'SEARCH_PAGE') {
                    runState.phase = 'ROOT_SEARCH';
                    let form = extractResultForm(document, null);
                    if (!form) throw new Error("فرم جستجو یافت نشد.");
                    let fd = new FormData(form);
                    let actionUrl = form.getAttribute('action'); if (!actionUrl) actionUrl = window.location.pathname + window.location.search;
                    workingDoc = await this.executeRequest(actionUrl, fd, 'root', 1);
                    if (!workingDoc) throw new Error("درخواست جستجو با خطا مواجه شد.");
                    state = analyzeResponseState(workingDoc, 'ROOT_POST');
                }

                runState.stats.batchesTotal = 1;

                if (state === 'RESULT_LIMIT_EXCEEDED') {
                    runState.phase = 'RECURSIVE_BATCHING';
                    let form = extractResultForm(workingDoc, null) || extractResultForm(document, null);
                    if (!form) throw new Error("فرم جستجو برای تقسیم هوشمند یافت نشد.");
                    let dimensions = QueryPlanner.discoverDimensions(form);
                    if (dimensions.length === 0) throw new Error("معیاری برای تقسیم جستجو یافت نشد.");
                    await this.processBatchNode(form, dimensions, [], 'root');
                } else if (state === 'RENDERABLE') {
                    runState.phase = 'ROOT_EXTRACTION';
                    let ext = await this.paginateBatch(workingDoc, 'root');
                    if (ext > 0) runState.stats.batchesCompletedWithRows++;
                    else runState.stats.batchesCompletedEmpty++;
                } else if (state === 'NO_RESULTS') {
                    runState.stats.batchesCompletedEmpty++;
                } else {
                    throw new Error("وضعیت نامشخص در پاسخ آموزشیار: " + state);
                }

                if (!abortController.signal.aborted) {
                    let covStatus = CoverageEngine.evaluate();
                    runState.status = covStatus;
                }
            } catch (err) {
                if (abortController.signal.aborted) {
                    runState.status = 'CANCELLED';
                } else {
                    runState.status = 'FAILED';
                    runState.error = err.message;
                    logAnomaly('FATAL_ERROR', { error: err.stack || err.message });
                }
            } finally {
                runState.durationMs = Math.round(performance.now() - runState.startedAt);
                runState.phase = 'DONE';
                runState.exportData = {
                    schemaVersion: EXPORT_SCHEMA_VERSION,
                    source: "darschyn-course-class-engine",
                    extractedAt: new Date().toISOString(),
                    term: runState.term,
                    context: runState.stats,
                    records: Array.from(recordsMap.values())
                };
                notifyUI();
            }
        },

        stop() {
            if (abortController) abortController.abort();
        }
    };

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'PING') {
            sendResponse({ type: 'PONG', state: runState });
        } else if (request.type === 'START_EXTRACTION') {
            if (runState.status === 'PROCESSING') {
                sendResponse({ status: 'ALREADY_RUNNING' });
            } else {
                recordsMap.clear();
                courseRegistry.clear();
                runState.stats = { requestsSent: 0, requestsSuccessful: 0, requestsFailed: 0, pagesProcessed: 0, batchesTotal: 0, batchesCompletedWithRows: 0, batchesCompletedEmpty: 0, batchesFailed: 0, batchesLimitExceeded: 0, batchesPaginationUnresolved: 0, batchesUnresolved: 0, rawRows: 0, uniqueClasses: 0, uniqueCourses: 0, duplicatesRemoved: 0 };
                runState.anomalies = [];
                runState.debug = { network: [], coverageStatus: 'UNKNOWN', identity: { strong: 0, compositeStrong: 0, compositeWeak: 0, ambiguous: 0, dropped: 0, merged: 0 }, pagination: { detected: 0, unresolved: 0, loops: 0, maxPagesHit: 0 }, tableDetection: { calls: 0, winningTableFound: false },
            parser: { rowsSeen: 0, validRows: 0, malformedRows: 0, malformedSamples: [] },
            classification: { searchPage: 0, limitExceeded: 0, renderable: 0, empty: 0, unknown: 0 }, warnings: [] };
                runState.error = null;
                runState.exportData = null;
                
                ExtractionEngine.startExtraction();
                sendResponse({ status: 'STARTED' });
            }
        } else if (request.type === 'STOP_EXTRACTION') {
            ExtractionEngine.stop();
            sendResponse({ status: 'STOPPED' });
        }
    });
}
