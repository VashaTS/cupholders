import { observer } from 'mobx-react-lite';
import React, { Fragment, useContext, useEffect, useState } from 'react';
import { Button, Checkbox, Grid, Header, Icon, Label, Modal, Segment } from 'semantic-ui-react';
import { RootStoreContext } from '../../app/stores/rootStore';
import { addDays, addWeeks, format, subDays, subWeeks } from 'date-fns';
import * as ExcelJS from 'exceljs';
import { IFifoBox } from '../../app/models/fifobox';
import agent from '../../app/api/agent';
import { Link } from 'react-router-dom';
import { IUserDispPrefs } from '../../app/models/user';

interface IDay {
    name:string;
    num:number;
}

const OrderList = () => {
  const days:IDay[] = [
    {name: "Poniedziałek", num: 1},
    {name: "Wtorek", num:2},
    {name: "Środa", num:3},
    {name: "Czwartek", num:4},
    {name: "Piątek", num:5},
    {name: "Sobota", num:6}
  ];
  const rootStore = useContext(RootStoreContext);
    const { currentUser, getCurrentUser } = rootStore.stateStore;
    const { machineNames, getMachines, activeOrders, getActiveOrders, colorPartially, updExcelColor, updLocalAO, elNames, EskalacjeData, getEskalacje } = rootStore.fifoStore;
  const { DispPrefData, getDispPrefs } = rootStore.userStore;
  const timeElapsed = Date.now();
  const today = new Date(timeElapsed);
  const [legendaOpen,setLegendaOpen] = useState(false);
  const [liniaFilter,setLiniaFilter] = useState("all");
  const [filterBy,setFilterBy] = useState<"mf" | "bm7" | "bm7t">("bm7t");
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [rcu, setRcu] = useState<IUserDispPrefs>(
        {
            id: 'a',
            claimsName: 'unknown',
            showEskal: false,
            showLongOp: false,
            showMoldFormLst: false,
            timeIcon: '.',
            showOutdated: false,
            sparateCoating: false,
            sumDailyTimes: false,
            longOpAbove: 480,
            machColorsAsBg: false,
            longOpCol: "red",
            coatingCol: ["#592693", "#4e97d1","#ee555e"],
            machCol: ["#FFFF00", "#AACC11", "#00FF00", "#a52121", "#cc9900"],
            showProjectNum: false,
            useIdentNotOrder: false,
            showDots: false,
            removeCoatingFormNormal: false,
            showBM7OldStyle: false
        }
    )
  
  const [excel_color_partialyy,set_excel_color_partially] = useState(colorPartially);
    const [modalOpen, setModalOpen] = useState(false);
  const [selMoldForms,setSelMoldForms] = useState("");
  const [longTime,setLongTime] = useState(480);
  const [fifoFilter,setFifoFilter] = useState("");
  const [showOpTimes,setShowOpTimes] = useState(true);
  const [openOrder,setOpenOrder] = useState("none");
  const [grr,setGrr] = useState([0,1]); //fake state to force redraw
  //stupid react
  const getWeek = (inp: Date) => {
    var date = new Date(inp.getTime());
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    // January 4 is always in week 1.
    var week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return (
      1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 -
          3 + ((week1.getDay() + 6) % 7)) / 7 )
    );
  };
const checkELNames = (inp:string) => {
    let cnt = false;
    if(inp){
      elNames.forEach(el => {
        if(inp.includes(el)){
          cnt=true;
        }
      });
    }
    return cnt;
  }

const isElectrodeDivers = (inp:IFifoBox) => {
  if(inp.identNumber==='15000024'){
    let l=inp.planTimes.split(';');
    let hasMill = false;
    let hasQC = false;
    let hasnameEL = false;
    l.forEach(op => {
      let co=op.split(':')[2];
      let nr=op.split(':')[4];
      if(co){
        if(co.length>1){
          // if(co.toLocaleLowerCase().includes('kontrola jakości')) hasQC=true;
          // if(co.toLocaleLowerCase().includes('frezowanie') && ) hasMill=true;
          if(co.toLocaleLowerCase().includes(' el-')) hasnameEL=true;
        }
      }
    })
    // (hasMill && !hasQC) ||
    if( hasnameEL){ //probably an electrode
      return true;
    }
    else return false;
  }
  else return false;
}

const decideCellColor = (ts:string) => {
    if (machineNames) {
        if (machineNames.filter(x => x.type === 'Drążarka Wgłębna').find(it => it.tsName.includes(ts))) return rcu.machCol[0];
        else if(machineNames.filter(x=>x.type==='Drążarka Drutowa').find(it=>it.tsName.includes(ts))) return rcu.machCol[1];
        else if(machineNames.filter(x=>x.type.includes('Szlifierka')).find(it=>it.tsName.includes(ts))) return rcu.machCol[3];
        else if (machineNames.filter(x => x.type.includes('Frezarka')).find(it => it.tsName.includes(ts))) return rcu.machCol[2];
        else if (machineNames.filter(x => x.type.includes('Tokarka')).find(it => it.tsName.includes(ts))) return rcu.machCol[4];
        else return '#ffffff';
        //else return '#000000';
  }
    else return '#ffffff';
    //else return '#000000';
}
const decideCellTextColor = (ts:string) => {
  if(machineNames){
    if(machineNames.filter(x=>x.type==='Drążarka Wgłębna').find(it=>it.tsName.includes(ts))) return rcu.machCol[0];
    else if(machineNames.filter(x=>x.type==='Drążarka Drutowa').find(it=>it.tsName.includes(ts))) return rcu.machCol[1];
    else if (machineNames.filter(x => x.type.includes('Szlifierka')).find(it => it.tsName.includes(ts))) return rcu.machCol[3];
    else if (machineNames.filter(x => x.type.includes('Frezarka')).find(it => it.tsName.includes(ts))) return rcu.machCol[2];
    else if(machineNames.filter(x=>x.type.includes('Tokarka')).find(it=>it.tsName.includes(ts))) return rcu.machCol[4];
    else return '#000000';
  }
  else return '#000000';
}
const decideNFCellColor = (inp:string) => {
  let pt= inp.split(':');
    if (pt[2].toLocaleLowerCase().includes('powłoka')) {
        if (pt[2].toLocaleLowerCase().includes('azot') || pt[2].toLocaleLowerCase().includes('nikiel')) return rcu.coatingCol[1];
        else return rcu.coatingCol[0];
    }
    else if (rcu.machColorsAsBg) return '#000000';
    else return '#ffffff'
}


const getXlsxFileName = () => {
  let d = new Date;
  return 'LZ_'+d.getFullYear()+(("0"+d.getMonth()).slice(-2))+(("0"+d.getDate()).slice(-2))+(("0"+d.getHours()).slice(-2))+(("0"+d.getMinutes()).slice(-2))+(("0"+d.getSeconds()).slice(-2));
}

const flipPriorytet = (inp:IFifoBox) => {
  if(activeOrders){
    if(currentUser.canGiveRed){
      let ef:IFifoBox = inp;
    ef.priorytet = !inp.priorytet;
      agent.AxFifo.update(ef).then(()=>{
        updLocalAO(ef);
      })
    }
    else{
      console.log('unauthorized');
    }
  }
}

const calcHours = (inp:IFifoBox[],type:string) => {
  if(machineNames){
    let sumMinutes = 0;
    inp.forEach(v => {
      let l=v.planTimes.split(';');
      l.forEach(ll => {
        let l0=ll.split(':');
        // let 
        let alreadyDone=false;
        machineNames.filter(x=>x.type.includes(type)).forEach(lll => {
          if(lll.tsName===l0[0]){
            if (!alreadyDone){
              sumMinutes=sumMinutes+(+l0[1]);
              alreadyDone=true;
            }  
          }
        });
      });
    });
    return String(sumMinutes);
  } 
  else return "0";
  
}

const nameFilter = (x:IFifoBox) => !(x.planTimes.includes('TS-13:0::'))
    && !(x.planTimes.includes('TS-13:0:Wykonanie części:'))
    && !(x.planTimes.includes('TS-13:0:Wykonanie częsci:'))
    && !(x.planTimes.includes('TS-13:0:wykonanie części:'))
    && !(x.planTimes.includes('TS-13:0:Wykonanie częsci formujących:'))
    && !(x.planTimes.includes('TS-13:0:Optymalizacjia:'))
    && !(x.planTimes.includes('TS-13:0:CZAS OSOBOWY PRODUKCJI NA MASZYNIE:'))
    && !(x.planTimes.includes('TS-13:0:Zlecenie główne:'))
    && !((x.planTimes.includes('TS-13:0:Przekazać ')) && !(x.planTimes.includes(';T')));


  const handleChngeWeek = (sign:string) => {
    if(sign==="+"){
        let xd=addWeeks(selectedDate,1);
        setSelectedDate(xd);
    }
    else{
      let xd=subWeeks(selectedDate,1);
        setSelectedDate(xd);
    }
    setGrr([...grr,1]);
    console.log(selectedDate.toISOString());
    }
    useEffect(() => {
        if (!currentUser) {
            getCurrentUser();
        }
    }, [currentUser]);
    useEffect(() => {
        if (!machineNames) {
            getMachines();
        }
    }, [machineNames]);
    useEffect(() => {
        if (!activeOrders) {
            getActiveOrders();
        }
    }, [activeOrders, getActiveOrders]);
    useEffect(() => {
        if (!EskalacjeData) {
            getEskalacje();
        }
    }, [EskalacjeData, getEskalacje]);
    useEffect(() => {
        if (!DispPrefData) {
            getDispPrefs();
        }
        else {
            let cu: IUserDispPrefs | null = null;
            if (DispPrefData && currentUser) {
                cu = DispPrefData.filter(x => x.claimsName === currentUser.claimsName)[0];
            }
            if (!cu) {
                let fu: IUserDispPrefs = {
                    id: 'a',
                    claimsName: 'unknown',
                    showEskal: false,
                    showLongOp: false,
                    showMoldFormLst: false,
                    timeIcon: '.',
                    showOutdated: false,
                    sparateCoating: false,
                    sumDailyTimes: false,
                    longOpAbove: 480,
                    machColorsAsBg: false,
                    longOpCol: "red",
                    coatingCol: ["#592693", "#4e97d1","#eeffaa"],
                    machCol: ["#FFFF00", "#AACC11", "#00FF00", "#a52121", "#cc9900"],
                    showProjectNum: false,
                    useIdentNotOrder: false,
                    showDots: false,
                    removeCoatingFormNormal: false,
                    showBM7OldStyle: false
                }
                setRcu(fu);
            }
            else {
                setRcu(cu);
            }
        }
    }, [DispPrefData]);


    const dotColorToExcel = (col:string) => {
        switch(col){
            case "red": return "FF0000";
            case "yellow": return "FFFF00";
            case "black": return "000000";
            case "pink": return "FFC0CB";
            case "magenta": return "FF00FF";
            default: return "FFFFFF";
        }
      }

    const decideColorPowł = (inp:string) => {
        // console.log('decideColorPowł input: '+inp);
        // console.log(rcu);
        if(inp.toLocaleLowerCase().includes('powłoka')) {
            // console.log('inp includes powłoka');
            if(inp.toLocaleLowerCase().includes('azot') || inp.toLocaleLowerCase().includes('nikiel')) {
                // console.log('inp includes azot or nikiel');
                return rcu.coatingCol[1];
            }
            else {
                // console.log('other powł');
                return rcu.coatingCol[0];
            }
        }
        else {
            // console.log('inp does not include powłoka');
            if(inp.toLocaleLowerCase().includes('precyz')){
                return rcu.coatingCol[2];
            }
            else{
                return (rcu.machColorsAsBg ? '#000000' : '#ffffff');
            }
            
        }
    }

    const genExcelAll = async () => {

        const bgSerwis = 'add8e6'; //was 87ceeb
        const bgNF = '39FF14';
        const bgST = 'FFA500';

        const borderStyle: ExcelJS.Border = {
            style: "thin",
            color: { argb: "000000" },
        };

        // 1. Normal - current week - always
        const workbook = new ExcelJS.Workbook();

        const sheet = workbook.addWorksheet(selectedDate.getFullYear().toString().substring(2, 4) + " KW " + getWeek(selectedDate));
        sheet.columns = rcu.showDots ?[
            { key: "order", width: 25 },
            { key: "proj", width: 20 },
            { key: "dot", width: 3 },
            { key: "op1", width: 20 },
            { key: "op2", width: 20 },
            { key: "op3", width: 20 },
            { key: "op4", width: 20 },
            { key: "op5", width: 20 },
            { key: "op6", width: 20 },
            { key: "op7", width: 20 }
        ] : [
            { key: "order", width: 25 },
            { key: "proj", width: 20 },
            { key: "op1", width: 20 },
            { key: "op2", width: 20 },
            { key: "op3", width: 20 },
            { key: "op4", width: 20 },
            { key: "op5", width: 20 },
            { key: "op6", width: 20 },
            { key: "op7", width: 20 }
        ];

        // Access a specific cell (A1) in the sheet
        const cell = sheet.getCell('A1');

        // Set the font style of the cell
        cell.font = {
            name: 'Calibri', // Font name
            size: 20, // Font size
            bold: true, // Bold font
        };
        cell.border = {
            top: borderStyle,
            left: borderStyle,
            bottom: borderStyle,
            right: borderStyle
        }
        // Set the cell's value
        cell.value = 'Lista Zleceń - ' + selectedDate.getFullYear().toString().substring(2, 4) + " KW " + getWeek(selectedDate) + ' - ' +(filterBy==="bm7" ? "MS7 Plan" : (filterBy==="bm7t" ? "MS7 Cel" :"MF"));
        sheet.mergeCells(1, 1, 1, 6);
        var rowCount = 2;
        if (activeOrders) {
            days.forEach(d => {
                let dayHeaderLength = activeOrders?.filter(x => getWeek(new Date((filterBy==="mf" ? x.mfPlan : (filterBy==="bm7" ? x.bm7planDT : x.bm7targetDT)))) === getWeek(selectedDate)
                        && (new Date((filterBy==="mf" ? x.mfPlan : (filterBy==="bm7" ? x.bm7planDT : x.bm7targetDT)))).getDay() === d.num && x.fifoNumber !== "0"
                        && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                        && nameFilter(x)
                        && !checkELNames(x.matname)
                        && !isElectrodeDivers(x)
                        && ((rcu.sparateCoating && rcu.removeCoatingFormNormal) ? !(x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł')) : true)
                    ).length;

                let dayHeaderContent = d.name + " " + (selectedDate.getDay() === d.num ? format(selectedDate, 'yyyy-MM-dd') : (selectedDate.getDay() > d.num ? format(subDays(selectedDate, Math.abs(selectedDate.getDay() - d.num)), 'yyyy-MM-dd') : format(addDays(selectedDate, Math.abs(selectedDate.getDay() - d.num)), 'yyyy-MM-dd'))) + " Ilość: " + dayHeaderLength;
                if ((d.num === 6 && dayHeaderLength !== 0) || (d.num !== 6)) {
                    // 1. Day header
                    let dayHeaderCell = sheet.getCell(rowCount, 1);
                    dayHeaderCell.value = dayHeaderContent;
                    dayHeaderCell.border = {
                        top: borderStyle,
                        left: borderStyle,
                        bottom: borderStyle,
                        right: borderStyle
                    }
                    dayHeaderCell.font = {
                        name: 'Calibri',
                        size: 16
                    }
                    sheet.mergeCells(rowCount, 1, rowCount, 3);

                    // 3. Time summary row
                    if (activeOrders && rcu.sumDailyTimes) {
                        let frezIlCell = sheet.getCell(rowCount, 6);
                        frezIlCell.value = 'Frezowanie: ' + calcHours(activeOrders?.filter(x => getWeek(new Date((rcu.showBM7OldStyle ? x.bm7targetDT : x.bm7planDT))) === getWeek(selectedDate)
                            && (new Date((rcu.showBM7OldStyle ? x.bm7targetDT : x.bm7planDT)).getDay() === d.num && x.fifoNumber !== "0")
                            && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                            && nameFilter(x)
                            && !checkELNames(x.matname)
                            && !isElectrodeDivers(x)
                            && ((rcu.sparateCoating && rcu.removeCoatingFormNormal) ? !(x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł')) : true)
                        ), 'Frezarka');
                        let edmCell = sheet.getCell(rowCount, 4);
                        edmCell.value = 'Drążenie: ' + calcHours(activeOrders?.filter(x => getWeek(new Date((rcu.showBM7OldStyle ? x.bm7targetDT : x.bm7planDT))) === getWeek(selectedDate)
                            && (new Date((rcu.showBM7OldStyle ? x.bm7targetDT : x.bm7planDT)).getDay() === d.num && x.fifoNumber !== "0")
                            && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                            && nameFilter(x)
                            && !checkELNames(x.matname)
                            && !isElectrodeDivers(x)
                            && ((rcu.sparateCoating && rcu.removeCoatingFormNormal) ? !(x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł')) : true)
                        ), 'Wgłębna');
                        let wedmCell = sheet.getCell(rowCount, 5);
                        wedmCell.value = 'Cięcie: ' + calcHours(activeOrders?.filter(x => getWeek(new Date((rcu.showBM7OldStyle ? x.bm7targetDT : x.bm7planDT))) === getWeek(selectedDate)
                            && (new Date((rcu.showBM7OldStyle ? x.bm7targetDT : x.bm7planDT)).getDay() === d.num && x.fifoNumber !== "0")
                            && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                            && nameFilter(x)
                            && !checkELNames(x.matname)
                            && !isElectrodeDivers(x)
                            && ((rcu.sparateCoating && rcu.removeCoatingFormNormal) ? !(x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł')) : true)
                        ), 'Drutowa');
                        let grindCell = sheet.getCell(rowCount, 7);
                        grindCell.value = 'Szlifowanie: ' + calcHours(activeOrders?.filter(x => getWeek(new Date((rcu.showBM7OldStyle ? x.bm7targetDT : x.bm7planDT))) === getWeek(selectedDate)
                            && (new Date((rcu.showBM7OldStyle ? x.bm7targetDT : x.bm7planDT)).getDay() === d.num && x.fifoNumber !== "0")
                            && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                            && nameFilter(x)
                            && !checkELNames(x.matname)
                            && !isElectrodeDivers(x)
                            && ((rcu.sparateCoating && rcu.removeCoatingFormNormal) ? !(x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł')) : true)
                        ), 'Szlifierka');
                    }

                    rowCount++; 

                    // 5. Orders for this day
                    let colNumber = 1;
                    activeOrders?.filter(x => getWeek(new Date((filterBy==="mf" ? x.mfPlan : (filterBy==="bm7" ? x.bm7planDT : x.bm7targetDT)))) === getWeek(selectedDate)
                        && (new Date((filterBy==="mf" ? x.mfPlan : (filterBy==="bm7" ? x.bm7planDT : x.bm7targetDT)))).getDay() === d.num && x.fifoNumber !== "0"
                        && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                        && nameFilter(x)
                        && !checkELNames(x.matname)
                        && !isElectrodeDivers(x)
                        && ((rcu.sparateCoating && rcu.removeCoatingFormNormal) ? !(x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł')) : true)
                    ).sort((a, b) => a.fifoNumber > b.fifoNumber ? 1 : -1).forEach(ord => {
                      // console.log('order line row number: '+rowCount);  
                      colNumber = 1;
                        let orderCell = sheet.getCell(rowCount, colNumber);
                        orderCell.value = ord.fifoNumber + " (" + ord.orderNumber + ")" + (ord.klient !== "none" ? " " + ord.klient : "") + (ord.opis ? (ord.opis.includes("[MCZ]") ? " [MCZ]" : "") : "");
                        orderCell.border = {
                            top: borderStyle,
                            left: borderStyle,
                            bottom: borderStyle,
                            right: borderStyle
                        }
                        orderCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',                                                           
                            fgColor: { argb: (ord.linia === "skyblue" ? (ord.bu === 'MetalPartsProduction(MPP)' ? bgST : bgSerwis) : bgNF) }, // background color
                        };
                        if (rcu.showProjectNum) {
                            colNumber++;
                            let projnumCell = sheet.getCell(rowCount, colNumber);
                            projnumCell.value = ord.kwzNumber;
                            projnumCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                        }
                        if(rcu.showDots){
                            colNumber++;
                            let dotCell = sheet.getCell(rowCount, colNumber);
                            dotCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            dotCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: dotColorToExcel(ord.dotColor) }, // background color
                            }
                        }
                        
                        colNumber++;
                        ord.planTimes.split(';').filter(x => x.split(':')[0].length > 0).sort((aa, bb) => aa.split(':')[4] > bb.split(':')[4] ? 1 : -1).forEach(op => {
                            let opCell = sheet.getCell(rowCount, colNumber);
                            const opParts = op.split(':');
                            const opPrefix = opParts[0];
                            const isEDM = ['TS-36','TS-38','TS-44', 'TS-58', 'TS-61'].includes(opPrefix);
                            const electrodeOrder = activeOrders?.find(x=>{
                                const isChildElectrode = x.parentOrder ===ord.orderNumber && (checkELNames(x.matname) || x.identNumber === '15000012');
                                const isELSibling = x.orderNumber.length===12 && x.orderNumber.includes(ord.orderNumber);
                                return isChildElectrode || isELSibling;
                            });
                            const shouldAddX = isEDM && !!electrodeOrder;
                            const xColor = electrodeOrder?.opDescr?.includes('CAM') ? 'FF000000' : 'FFFF0000';
                            const baseText = opPrefix+' '+
                            (opParts[2] ? (opParts[2].toLocaleLowerCase().includes('powłoka') ? opParts[2] : opParts[2].substring(0,char_amount)) : "")+' '+
                            ((currentUser.canGiveRed && showOpTimes) ? "- "+opParts[1]+(opParts[5] !=='0' ? "/"+opParts[5] : "") : "");
                            opCell.value = {
                                richText: shouldAddX ? [
                                    {text:baseText},
                                    {
                                        text: ' X',
                                        font: {
                                            color: {argb: xColor},
                                            bold: true
                                        }
                                    }
                                ]
                                : [
                                    {text: baseText}
                                ]
                            };
                            // (isEDM && hasElectrodeChild ? " X" : ""); 
                            opCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: (rcu.machColorsAsBg ? decideCellColor(op.split(':')[0]).slice(-6) : decideColorPowł(op.split(':')[2]).slice(-6)) }
                            }
                            opCell.font = {
                                color: { argb: (rcu.machColorsAsBg ? decideColorPowł(op.split(':')[2]).slice(-6) : decideCellTextColor(op.split(':')[0]).slice(-6)) }
                            }
                            opCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            colNumber++;
                        })
                        rowCount++; 
                    })
                }
            });
        }

        // 2. Optional Zaległości
        if (rcu.showOutdated) {
            const zalegSheet = workbook.addWorksheet("Zaległości");
            zalegSheet.columns = rcu.showDots ?[
            { key: "order", width: 25 },
            { key: "proj", width: 20 },
            { key: "dot", width: 3 },
            { key: "op1", width: 20 },
            { key: "op2", width: 20 },
            { key: "op3", width: 20 },
            { key: "op4", width: 20 },
            { key: "op5", width: 20 },
            { key: "op6", width: 20 },
            { key: "op7", width: 20 }
        ] : [
            { key: "order", width: 25 },
            { key: "proj", width: 20 },
            { key: "op1", width: 20 },
            { key: "op2", width: 20 },
            { key: "op3", width: 20 },
            { key: "op4", width: 20 },
            { key: "op5", width: 20 },
            { key: "op6", width: 20 },
            { key: "op7", width: 20 }
        ];

            const titleCell = zalegSheet.getCell('A1');
            titleCell.font = {
                name: 'Calibri', // Font name
                size: 20, // Font size
                bold: true, // Bold font
            };
            titleCell.border = {
                top: borderStyle,
                left: borderStyle,
                bottom: borderStyle,
                right: borderStyle
            }
            titleCell.value = 'Zaległości - termin przed ' + format(today, 'yyyy-MM-dd');
            zalegSheet.mergeCells(1, 1, 1, 6);
            let zRow = 2;
            let zCol = 1;
            activeOrders?.filter(x => (new Date((filterBy === "mf" ? x.mfPlan : x.bm7targetDT))) < subDays(today, 1)
                && x.fifoNumber !== "0"
                && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                && nameFilter(x)
                && !checkELNames(x.matname)
                && !isElectrodeDivers(x)
            ).forEach(ord => {
                let zorderCell = zalegSheet.getCell(zRow, zCol);
                zorderCell.value = ord.fifoNumber + " (" + ord.orderNumber + ")" + (ord.klient !== "none" ? " " + ord.klient : "");
                zorderCell.border = {
                    top: borderStyle,
                    left: borderStyle,
                    bottom: borderStyle,
                    right: borderStyle
                }
                zorderCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: (ord.linia === "skyblue" ? (ord.bu === 'MetalPartsProduction(MPP)' ? bgST : bgSerwis) : bgNF) },
                };
                if (rcu.showProjectNum) {
                    zCol++;
                    let projnumCell = zalegSheet.getCell(zRow, zCol);
                    projnumCell.value = ord.kwzNumber;
                    projnumCell.border = {
                        top: borderStyle,
                        left: borderStyle,
                        bottom: borderStyle,
                        right: borderStyle
                    }
                }
                if(rcu.showDots){
                            zCol++;
                            let dotCell = zalegSheet.getCell(zRow, zCol);
                            dotCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            dotCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: dotColorToExcel(ord.dotColor) }, // background color
                            }
                        }
                zCol++;
                ord.planTimes.split(';').filter(x => x.split(':')[0].length > 0).sort((aa, bb) => aa.split(':')[4] > bb.split(':')[4] ? 1 : -1).forEach(op => {
                    let zopCell = zalegSheet.getCell(zRow, zCol);
                    const opParts = op.split(':');
                    const opPrefix = opParts[0];
                    const isEDM = ['TS-36','TS-38','TS-44', 'TS-58', 'TS-61'].includes(opPrefix);
                    const electrodeOrder = activeOrders?.find(x=>{
                        const isChildElectrode = x.parentOrder ===ord.orderNumber && (checkELNames(x.matname) || x.identNumber === '15000012');
                        const isELSibling = x.orderNumber.length===12 && x.orderNumber.includes(ord.orderNumber);
                        return isChildElectrode || isELSibling;
                    });
                    const shouldAddX = isEDM && !!electrodeOrder;
                    const xColor = electrodeOrder?.opDescr?.includes('CAM') ? 'FF000000' : 'FFFF0000';
                    const baseText = opPrefix+' '+
                        (opParts[2] ? (opParts[2].toLocaleLowerCase().includes('powłoka') ? opParts[2] : opParts[2].substring(0,char_amount)) : "")+' '+
                        ((currentUser.canGiveRed && showOpTimes) ? "- "+opParts[1]+(opParts[5] !=='0' ? "/"+opParts[5] : "") : "");
                    zopCell.value = {
                        richText: shouldAddX ? [
                            {text:baseText},
                            {
                                text: ' X',
                                font: {
                                    color: {argb: xColor},
                                    bold: true
                                }
                            }
                        ]
                        : [
                            {text: baseText}
                        ]
                    };
                    // zopCell.value = op.split(':')[0] + '-' + (op.split(':')[2] ? (op.split(':')[2].toLocaleLowerCase().includes('powłoka') ? op.split(':')[2] : op.split(':')[2].substring(0, char_amount)) : "") + ' ' + ((currentUser.canGiveRed && showOpTimes) ? "- " + (op.split(':')[5] !== '0' ? op.split(':')[5] + "/" : "") + op.split(':')[1] : "");
                            
                    zopCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: (rcu.machColorsAsBg ? decideCellColor(op.split(':')[0]).slice(-6) : 'ffffff') }
                    }
                    zopCell.border = {
                        top: borderStyle,
                        left: borderStyle,
                        bottom: borderStyle,
                        right: borderStyle
                    }
                    zopCell.font = {
                        color: { argb: '000000' }
                    }
                    zCol++;
                });
                zCol = 1;
                zRow++;
            });
        }

        // 3. Optional Eskalacje
        if (rcu!.showEskal) {
            let esk = workbook.addWorksheet('Eskalacje');
            esk.columns = rcu.showDots ?[
            { key: "order", width: 25 },
            { key: "proj", width: 20 },
            { key: "dot", width: 3 },
            {key: "eskData", width: 20},
            {key: "eskText", width: 30},
            { key: "op1", width: 20 },
            { key: "op2", width: 20 },
            { key: "op3", width: 20 },
            { key: "op4", width: 20 },
            { key: "op5", width: 20 },
            { key: "op6", width: 20 },
            { key: "op7", width: 20 }
        ] : [
            { key: "order", width: 25 },
            { key: "proj", width: 20 },
            {key: "eskData", width: 20},
            {key: "eskText", width: 30},
            { key: "op1", width: 20 },
            { key: "op2", width: 20 },
            { key: "op3", width: 20 },
            { key: "op4", width: 20 },
            { key: "op5", width: 20 },
            { key: "op6", width: 20 },
            { key: "op7", width: 20 }
        ];

            let ecell = esk.getCell('A1');
            ecell.font = {
                name: 'Calibri', // Font name
                size: 20, // Font size
                bold: true, // Bold font
            };
            ecell.border = {
                top: borderStyle,
                left: borderStyle,
                bottom: borderStyle,
                right: borderStyle
            };
            ecell.value = 'Eskalacje';
            esk.mergeCells(1, 1, 1, 6);
            var rowCount = 2;
            if (activeOrders) {
                const eskOrders = activeOrders.filter(ord => ord.isEskal ? true : false);
                // days.forEach(d => {
                    // let dayHeaderLength = eskOrders?.filter(x => getWeek(new Date(x.mfPlan)) === getWeek(selectedDate)
                    //     && (new Date(x.mfPlan)).getDay() === d.num && x.fifoNumber !== "0"
                    //     && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                    //     && nameFilter(x)
                    //     && !checkELNames(x.matname)
                    //     && !isElectrodeDivers(x)
                    // ).length;

                    // let dayHeaderContent = d.name + " " + (selectedDate.getDay() === d.num ? format(selectedDate, 'yyyy-MM-dd') : (selectedDate.getDay() > d.num ? format(subDays(selectedDate, Math.abs(selectedDate.getDay() - d.num)), 'yyyy-MM-dd') : format(addDays(selectedDate, Math.abs(selectedDate.getDay() - d.num)), 'yyyy-MM-dd'))) + " Ilość: " + dayHeaderLength;
                    // if ((d.num === 6 && dayHeaderLength !== 0) || (d.num !== 6)) {
                        // let dayHeaderCell = esk.getCell(rowCount, 1);
                        // dayHeaderCell.value = dayHeaderContent;
                        // dayHeaderCell.border = {
                        //     top: borderStyle,
                        //     left: borderStyle,
                        //     bottom: borderStyle,
                        //     right: borderStyle
                        // }
                        // dayHeaderCell.font = {
                        //     name: 'Calibri',
                        //     size: 16
                        // }
                        // esk.mergeCells(rowCount, 1, rowCount, 3);
                        // if (activeOrders && rcu.sumDailyTimes) {
                        //     let frezIlCell = esk.getCell(rowCount, 6);
                        //     frezIlCell.value = 'Frezowanie: ' + calcHours(eskOrders?.filter(x => getWeek(new Date(x.bm7planDT)) === getWeek(selectedDate)
                        //         && (new Date(x.bm7planDT).getDay() === d.num && x.fifoNumber !== "0")
                        //         && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                        //         && nameFilter(x)
                        //         && !checkELNames(x.matname)
                        //         && !isElectrodeDivers(x)
                        //     ), 'Frezarka');
                        //     let edmCell = esk.getCell(rowCount, 4);
                        //     edmCell.value = 'Drążenie: ' + calcHours(eskOrders?.filter(x => getWeek(new Date(x.bm7planDT)) === getWeek(selectedDate)
                        //         && (new Date(x.bm7planDT).getDay() === d.num && x.fifoNumber !== "0")
                        //         && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                        //         && nameFilter(x)
                        //         && !checkELNames(x.matname)
                        //         && !isElectrodeDivers(x)
                        //     ), 'Wgłębna');
                        //     let wedmCell = esk.getCell(rowCount, 5);
                        //     wedmCell.value = 'Cięcie: ' + calcHours(eskOrders?.filter(x => getWeek(new Date(x.bm7planDT)) === getWeek(selectedDate)
                        //         && (new Date(x.bm7planDT).getDay() === d.num && x.fifoNumber !== "0")
                        //         && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                        //         && nameFilter(x)
                        //         && !checkELNames(x.matname)
                        //         && !isElectrodeDivers(x)
                        //     ), 'Drutowa');
                        //     let grindCell = esk.getCell(rowCount, 7);
                        //     grindCell.value = 'Szlifowanie: ' + calcHours(eskOrders?.filter(x => getWeek(new Date(x.bm7planDT)) === getWeek(selectedDate)
                        //         && (new Date(x.bm7planDT).getDay() === d.num && x.fifoNumber !== "0")
                        //         && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                        //         && nameFilter(x)
                        //         && !checkELNames(x.matname)
                        //         && !isElectrodeDivers(x)
                        //     ), 'Szlifierka');
                        // }
                        // rowCount++;
                        let colNumber = 1;
                        //add actual orders here
                        eskOrders?.filter(x => 
                            // getWeek(new Date((filterBy === "mf" ? x.mfPlan : x.bm7planDT))) === getWeek(selectedDate)
                            // && (new Date((filterBy === "mf" ? x.mfPlan : x.bm7planDT))).getDay() === d.num && x.fifoNumber !== "0"
                            (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                            && nameFilter(x)
                            && !checkELNames(x.matname)
                            && !isElectrodeDivers(x)
                        ).sort((a, b) => a.fifoNumber > b.fifoNumber ? 1 : -1).forEach(ord => {
                            colNumber = 1;
                            let orderCell = esk.getCell(rowCount, colNumber);
                            orderCell.value = ord.fifoNumber + " (" + ord.orderNumber + ")" + (ord.klient !== "none" ? " " + ord.klient : "") + (ord.opis ? (ord.opis.includes("[MCZ]") ? " [MCZ]" : "") : "");
                            orderCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            orderCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',                                                           
                                fgColor: { argb: (ord.linia === "skyblue" ? (ord.bu === 'MetalPartsProduction(MPP)' ? bgST : bgSerwis) : bgNF) }, // background color
                            };
                            if (rcu.showProjectNum) {
                                colNumber++;
                                let projnumCell = esk.getCell(rowCount, colNumber);
                                projnumCell.value = ord.kwzNumber;
                                projnumCell.border = {
                                    top: borderStyle,
                                    left: borderStyle,
                                    bottom: borderStyle,
                                    right: borderStyle
                                }
                            }
                            if(rcu.showDots){
                            colNumber++;
                            let dotCell = esk.getCell(rowCount, colNumber);
                            dotCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            dotCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: dotColorToExcel(ord.dotColor) }, // background color
                            }
                        }
                        colNumber++;
                            let eskDataCell = esk.getCell(rowCount, colNumber);
                            eskDataCell.value = ord.eskalDate;
                            eskDataCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            colNumber++;
                            let eskTextCell = esk.getCell(rowCount, colNumber);
                            eskTextCell.value = ord.eskalComment;
                            eskTextCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            colNumber++;
                            ord.planTimes.split(';').filter(x => x.split(':')[0].length > 0).sort((aa, bb) => aa.split(':')[4] > bb.split(':')[4] ? 1 : -1).forEach(op => {
                                let opCell = esk.getCell(rowCount, colNumber);
                                //opCell.value = op.split(':')[0] + '-' + (op.split(':')[2] ? (op.split(':')[2].substring(0, char_amount)) : "") + ' ' + ((currentUser.canGiveRed && showOpTimes) ? "- " + op.split(':')[1] : "");
                                opCell.value = op.split(':')[0] + '-' + (op.split(':')[2] ? (op.split(':')[2].toLocaleLowerCase().includes('powłoka') ? op.split(':')[2] : op.split(':')[2].substring(0, char_amount)) : "") + ' ' + ((currentUser.canGiveRed && showOpTimes) ? "- " + (op.split(':')[5] !== '0' ? op.split(':')[5] + "/" : "") + op.split(':')[1] : "");
                                opCell.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: (rcu.machColorsAsBg ? decideCellColor(op.split(':')[0]).slice(-6) : decideColorPowł(op.split(':')[2]).slice(-6)) }
                                }
                                opCell.font = {
                                    color: { argb: (rcu.machColorsAsBg ? decideColorPowł(op.split(':')[2]).slice(-6) : decideCellTextColor(op.split(':')[0]).slice(-6)) }
                                }
                                opCell.border = {
                                    top: borderStyle,
                                    left: borderStyle,
                                    bottom: borderStyle,
                                    right: borderStyle
                                }
                                colNumber++;
                            })

                            rowCount++;
                        })
                    // }
                // });
            }
        }

        // 4. Powłoki
        if (rcu.sparateCoating) {
            const sheet2 = workbook.addWorksheet(selectedDate.getFullYear().toString().substring(2, 4) + " KW " + getWeek(selectedDate) + " MF - powłoki i MB");
            sheet2.columns = rcu.showDots ?[
            { key: "order", width: 25 },
            { key: "proj", width: 20 },
            { key: "dot", width: 3 },
            { key: "op1", width: 20 },
            { key: "op2", width: 20 },
            { key: "op3", width: 20 },
            { key: "op4", width: 20 },
            { key: "op5", width: 20 },
            { key: "op6", width: 20 },
            { key: "op7", width: 20 }
        ] : [
            { key: "order", width: 25 },
            { key: "proj", width: 20 },
            { key: "op1", width: 20 },
            { key: "op2", width: 20 },
            { key: "op3", width: 20 },
            { key: "op4", width: 20 },
            { key: "op5", width: 20 },
            { key: "op6", width: 20 },
            { key: "op7", width: 20 }
        ];

            const cell2 = sheet2.getCell('A1');
            cell2.font = {
                name: 'Calibri', // Font name
                size: 20, // Font size
                bold: true, // Bold font
            };
            cell2.border = {
                top: borderStyle,
                left: borderStyle,
                bottom: borderStyle,
                right: borderStyle
            }
            cell2.value = 'Lista Zleceń - ' + selectedDate.getFullYear().toString().substring(2, 4) + " KW " + getWeek(selectedDate) + ' - MF';
            sheet2.mergeCells(1, 1, 1, 7);

            var rowCount = 2;
            if (activeOrders) {
                days.forEach(d => {
                    let dayHeaderLength = activeOrders?.filter(x => getWeek(new Date(x.mfPlan)) === getWeek(selectedDate)
                        && (new Date(x.mfPlan)).getDay() === d.num && x.fifoNumber !== "0"
                        && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                        && nameFilter(x)
                        && !checkELNames(x.matname)
                        && !isElectrodeDivers(x)
                        && (x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł'))
                    ).length;

                    let dayHeaderContent = d.name + " " + (selectedDate.getDay() === d.num ? format(selectedDate, 'yyyy-MM-dd') : (selectedDate.getDay() > d.num ? format(subDays(selectedDate, Math.abs(selectedDate.getDay() - d.num)), 'yyyy-MM-dd') : format(addDays(selectedDate, Math.abs(selectedDate.getDay() - d.num)), 'yyyy-MM-dd'))) + " Ilość: " + dayHeaderLength;
                    if ((d.num === 6 && dayHeaderLength !== 0) || (d.num !== 6)) {
                        // 1. Day header
                        let dayHeaderCell = sheet2.getCell(rowCount, 1);
                        dayHeaderCell.value = dayHeaderContent;
                        dayHeaderCell.border = {
                            top: borderStyle,
                            left: borderStyle,
                            bottom: borderStyle,
                            right: borderStyle
                        }
                        dayHeaderCell.font = {
                            name: 'Calibri',
                            size: 16
                        }
                        sheet2.mergeCells(rowCount, 1, rowCount, 3);

                        // 3. Time summary row
                        if (activeOrders && rcu.sumDailyTimes) {
                            let frezIlCell = sheet2.getCell(rowCount, 6);
                            frezIlCell.value = 'Frezowanie: ' + calcHours(activeOrders?.filter(x => getWeek(new Date(x.bm7planDT)) === getWeek(selectedDate)
                                && (new Date(x.bm7planDT).getDay() === d.num && x.fifoNumber !== "0")
                                && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                                && nameFilter(x)
                                && !checkELNames(x.matname)
                                && !isElectrodeDivers(x)
                                && (x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł'))
                            ), 'Frezarka');
                            let edmCell = sheet2.getCell(rowCount, 4);
                            edmCell.value = 'Drążenie: ' + calcHours(activeOrders?.filter(x => getWeek(new Date(x.bm7planDT)) === getWeek(selectedDate)
                                && (new Date(x.bm7planDT).getDay() === d.num && x.fifoNumber !== "0")
                                && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                                && nameFilter(x)
                                && !checkELNames(x.matname)
                                && !isElectrodeDivers(x)
                                && (x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł'))
                            ), 'Wgłębna');
                            let wedmCell = sheet2.getCell(rowCount, 5);
                            wedmCell.value = 'Cięcie: ' + calcHours(activeOrders?.filter(x => getWeek(new Date(x.bm7planDT)) === getWeek(selectedDate)
                                && (new Date(x.bm7planDT).getDay() === d.num && x.fifoNumber !== "0")
                                && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                                && nameFilter(x)
                                && !checkELNames(x.matname)
                                && !isElectrodeDivers(x)
                                && (x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł'))
                            ), 'Drutowa');
                            let grindCell = sheet2.getCell(rowCount, 7);
                            grindCell.value = 'Szlifowanie: ' + calcHours(activeOrders?.filter(x => getWeek(new Date(x.bm7planDT)) === getWeek(selectedDate)
                                && (new Date(x.bm7planDT).getDay() === d.num && x.fifoNumber !== "0")
                                && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                                && nameFilter(x)
                                && !checkELNames(x.matname)
                                && !isElectrodeDivers(x)
                                && (x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł'))
                            ), 'Szlifierka');
                        }

                        rowCount++; 

                        // 5. Orders for this day
                        let colNumber = 1;
                        activeOrders?.filter(x => getWeek(new Date(x.mfPlan)) === getWeek(selectedDate)
                            && (new Date(x.mfPlan)).getDay() === d.num && x.fifoNumber !== "0"
                            && (liniaFilter === "all" ? true : (liniaFilter === x.linia ? true : false))
                            && nameFilter(x)
                            && !checkELNames(x.matname)
                            && !isElectrodeDivers(x)
                            && (x.kwzNumber.includes('MB-') || x.planTimes.toLocaleLowerCase().includes('powł'))
                        ).sort((a, b) => a.fifoNumber > b.fifoNumber ? 1 : -1).forEach(ord => {
                            colNumber = 1;
                            let orderCell = sheet2.getCell(rowCount, colNumber);
                            orderCell.value = ord.fifoNumber + " (" + ord.identNumber + ")";
                            orderCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            orderCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: (ord.linia === "skyblue" ? (ord.bu === 'MetalPartsProduction(MPP)' ? 'FFA500' : '87CEEB') : '39FF14') }, // background color
                            };
                            if (rcu.showProjectNum) {
                                colNumber++;
                                let projnumCell = sheet2.getCell(rowCount, colNumber);
                                projnumCell.value = ord.kwzNumber;
                                projnumCell.border = {
                                    top: borderStyle,
                                    left: borderStyle,
                                    bottom: borderStyle,
                                    right: borderStyle
                                }
                            }
                            if(rcu.showDots){
                            colNumber++;
                            let dotCell = sheet2.getCell(rowCount, colNumber);
                            dotCell.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            dotCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: dotColorToExcel(ord.dotColor) }, // background color
                            }
                        }
                            colNumber++;
                            ord.planTimes.split(';').filter(x => x.split(':')[0].length > 0).sort((aa, bb) => aa.split(':')[4] > bb.split(':')[4] ? 1 : -1).forEach(op => {
                                let opCell = sheet2.getCell(rowCount, colNumber);
                                const opParts = op.split(':');
                                const opPrefix = opParts[0];
                                const isEDM = ['TS-36','TS-38','TS-44', 'TS-58', 'TS-61'].includes(opPrefix);
                                const electrodeOrder = activeOrders?.find(x=>{
                                    const isChildElectrode = x.parentOrder ===ord.orderNumber && (checkELNames(x.matname) || x.identNumber === '15000012');
                                    const isELSibling = x.orderNumber.length===12 && x.orderNumber.includes(ord.orderNumber);
                                    return isChildElectrode || isELSibling;
                                });
                                const shouldAddX = isEDM && !!electrodeOrder;
                                const xColor = electrodeOrder?.opDescr?.includes('CAM') ? 'FF000000' : 'FFFF0000';
                                const baseText = opPrefix+' '+
                                (opParts[2] ? (opParts[2].toLocaleLowerCase().includes('powłoka') ? opParts[2] : opParts[2].substring(0,char_amount)) : "")+' '+
                                ((currentUser.canGiveRed && showOpTimes) ? "- "+opParts[1]+(opParts[5] !=='0' ? "/"+opParts[5] : "") : "");
                                opCell.value = {
                                    richText: shouldAddX ? [
                                        {text:baseText},
                                        {
                                            text: ' X',
                                            font: {
                                                color: {argb: xColor},
                                                bold: true
                                            }
                                        }
                                    ]
                                    : [
                                        {text: baseText}
                                    ]
                                };
                                // opCell.value = op.split(':')[0] + '-' + (op.split(':')[2] ? (op.split(':')[2].toLocaleLowerCase().includes('powłoka') ? op.split(':')[2] : op.split(':')[2].substring(0, char_amount)) : "") + ' ' + ((currentUser.canGiveRed && showOpTimes) ? "- " + (op.split(':')[5] !== '0' ? op.split(':')[5] + "/" : "") + op.split(':')[1] : "");
                                
                                opCell.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: (rcu.machColorsAsBg ? decideCellColor(op.split(':')[0]).slice(-6) : decideColorPowł(op.split(':')[2]).slice(-6)) }
                                }
                                opCell.font = {
                                    color: { argb: (rcu.machColorsAsBg ? decideColorPowł(op.split(':')[2]).slice(-6) : decideCellTextColor(op.split(':')[0]).slice(-6)) }
                                }
                                opCell.border = {
                                    top: borderStyle,
                                    left: borderStyle,
                                    bottom: borderStyle,
                                    right: borderStyle
                                }
                                colNumber++;
                            })

                            rowCount++; // Move to next row for next order
                        })
                    }
                });
            }
        }

        // 5. Optional Mold Forms
        if (selMoldForms.length > 0) {
            selMoldForms.split(',').forEach(kwz => {
                let ksh = workbook.addWorksheet('KWZ ' + kwz);
                let kcell = ksh.getCell('A1');
                ksh.columns = [
                    { key: "order", width: 16 },
                    { key: "op1", width: 22 },
                    { key: "op2", width: 22 },
                    { key: "op3", width: 22 },
                    { key: "op4", width: 22 },
                    { key: "op5", width: 22 },
                    { key: "op6", width: 22 },
                    { key: "op7", width: 22 },
                    { key: "op8", width: 22 }
                ];
                kcell.font = {
                    name: 'Calibri', // Font name
                    size: 20, // Font size
                    bold: true, // Bold font
                };
                kcell.border = {
                    top: borderStyle,
                    left: borderStyle,
                    bottom: borderStyle,
                    right: borderStyle
                };
                kcell.value = 'Forma ' + kwz + '(Fifo ' + activeOrders?.filter(x => x.kwzNumber === kwz)[0].fifoNumber + ')';
                ksh.mergeCells(1, 1, 1, 6);
                let rowCount = 2;
                let colNumber = 1;
                if (activeOrders && showOpTimes) {
                    let frezIlCell = ksh.getCell(rowCount, 6);
                    frezIlCell.value = 'Frezowanie: ' + calcHours(activeOrders?.filter(x => (x.kwzNumber === kwz) && x.fifoNumber !== "0"
                        && nameFilter(x)
                    ), 'Frezarka');
                    let edmCell = ksh.getCell(rowCount, 4);
                    edmCell.value = 'Drążenie: ' + calcHours(activeOrders?.filter(x => (x.kwzNumber === kwz) && x.fifoNumber !== "0"
                        && nameFilter(x)
                    ), 'Wgłębna');
                    let wedmCell = ksh.getCell(rowCount, 5);
                    wedmCell.value = 'Cięcie: ' + calcHours(activeOrders?.filter(x => (x.kwzNumber === kwz) && x.fifoNumber !== "0"
                        && nameFilter(x)
                    ), 'Drutowa');
                    let grindCell = ksh.getCell(rowCount, 7);
                    grindCell.value = 'Szlifowanie: ' + calcHours(activeOrders?.filter(x => (x.kwzNumber === kwz) && x.fifoNumber !== "0"
                        && nameFilter(x)
                    ), 'Szlifierka');
                }

                rowCount++;
                activeOrders?.filter(x => (x.kwzNumber === kwz) && x.fifoNumber !== "0"
                    && nameFilter(x)
                    // && !checkELNames(x.matname)
                    && !isElectrodeDivers(x)

                ).sort((a, b) => a.fifoNumber > b.fifoNumber ? 1 : -1).forEach(ord => {
                    colNumber = 1;
                    let orderCell = ksh.getCell(rowCount, colNumber);
                    orderCell.value = ord.fifoNumber + " (" + ord.identNumber + ")";
                    orderCell.border = {
                        top: borderStyle,
                        left: borderStyle,
                        bottom: borderStyle,
                        right: borderStyle
                    }
                    orderCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: (ord.linia === "skyblue" ? (ord.bu === 'MetalPartsProduction(MPP)' ? 'FFA500' : '87CEEB') : '39FF14') }, // background color
                    };
                    colNumber++;
                    ord.planTimes.split(';').filter(x => x.split(':')[0].length > 0).sort((aa, bb) => aa.split(':')[4] > bb.split(':')[4] ? 1 : -1).forEach(op => {
                        let opCell = ksh.getCell(rowCount, colNumber);
                        opCell.value = op.split(':')[0] + '-' + (op.split(':')[2] ? (op.split(':')[2].toLocaleLowerCase().includes('powłoka') ? op.split(':')[2] : op.split(':')[2].substring(0, char_amount)) : "") + ' ' + ((currentUser.canGiveRed && showOpTimes) ? "- " + (op.split(':')[5] !== '0' ? op.split(':')[5] + "/" : "") + op.split(':')[1] : "");
                        opCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: (rcu.machColorsAsBg ? decideCellColor(op.split(':')[0]).slice(-6) : decideColorPowł(op.split(':')[2]).slice(-6)) }
                        }
                        opCell.font = {
                            color: { argb: (rcu.machColorsAsBg ? decideColorPowł(op.split(':')[2]).slice(-6) : decideCellTextColor(op.split(':')[0]).slice(-6)) }
                        }
                        opCell.border = {
                            top: borderStyle,
                            left: borderStyle,
                            bottom: borderStyle,
                            right: borderStyle
                        }
                        colNumber++;
                    })

                    rowCount++;
                    activeOrders?.filter(x => (x.kwzNumber === kwz) && x.fifoNumber !== "0"
                        && nameFilter(x)
                        && checkELNames(x.matname)
                        && isElectrodeDivers(x)
                        && x.parentOrder === ord.orderNumber
                    ).forEach(el => {
                        colNumber = 1;
                        let elCell = ksh.getCell(rowCount, colNumber);
                        elCell.value = "EL"
                        colNumber++;
                        let eoc = ksh.getCell(rowCount, colNumber);
                        eoc.value = el.fifoNumber + " (" + el.identNumber + ")";
                        eoc.border = {
                            top: borderStyle,
                            left: borderStyle,
                            bottom: borderStyle,
                            right: borderStyle
                        }
                        eoc.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: (ord.linia === "skyblue" ? (ord.bu === 'MetalPartsProduction(MPP)' ? 'FFA500' : '87CEEB') : '39FF14') }, // background color
                        };
                        colNumber++;
                        el.planTimes.split(';').filter(x => x.split(':')[0].length > 0).sort((aa, bb) => aa.split(':')[4] > bb.split(':')[4] ? 1 : -1).forEach(op => {
                            let opCelle = ksh.getCell(rowCount, colNumber);
                            opCelle.value = op.split(':')[0] + '-' + (op.split(':')[2] ? (op.split(':')[2].toLocaleLowerCase().includes('powłoka') ? op.split(':')[2] : op.split(':')[2].substring(0, char_amount)) : "") + ' ' + ((currentUser.canGiveRed && showOpTimes) ? "- " + (op.split(':')[5] !== '0' ? op.split(':')[5] + "/" : "") + op.split(':')[1] : "");
                            opCelle.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: decideNFCellColor(op).slice(-6) }
                            }
                            opCelle.font = {
                                color: { argb: (op.split(':')[3] === "20" ? decideCellColor(op.split(':')[0]).slice(-6) : excel_color_partialyy.slice(-6)) }
                            }
                            opCelle.border = {
                                top: borderStyle,
                                left: borderStyle,
                                bottom: borderStyle,
                                right: borderStyle
                            }
                            colNumber++;
                        })

                        rowCount++;
                    })
                });

            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getXlsxFileName() + '.xlsx';
        a.click();
    }

    const hadleModalOrNor = () => {
        let showModal = false;
        if (DispPrefData && currentUser) {
            let check = DispPrefData.filter(x => x.claimsName === currentUser.claimsName)[0];
            if (check) {
                showModal = check.showMoldFormLst;
            }
        }
        if (showModal) {
            setModalOpen(true);
        }
        else {
            genExcelAll();
        }
    }

const char_amount = 6;
    return(
        <Fragment>
            <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
                <Modal.Header>Wybierz formy</Modal.Header>
                <Modal.Content>
                    Dodatkowo pokaż wszystkie pozostałe operacje dla formy:
                    <input name="f" value={selMoldForms} onChange={(event) => setSelMoldForms(event.target.value)} size={20} />
                    <br />Można wpisać kilka form, rozdzielonych przecinkami (bez spacji).
                </Modal.Content>
                <Modal.Actions>
                    <Button positive onClick={() => genExcelAll()}>OK</Button>
                </Modal.Actions>
            </Modal>
            <div
        style={{
          position: "fixed",
          top: "44px",
          left: "-30px",
          paddingTop: "0px",
          marginTop: "0px",
          paddingLeft: "30px",
          paddingRight: "30px",
          backgroundImage: "url(/assets/gr1.png)",
          zIndex: 100,
        }}
      >
        <Header size='huge' style={{marginTop:50}}>{"Lista Zleceń "}
       &nbsp;&nbsp;Sortuj wg:&nbsp;&nbsp;
       <Button.Group>
        <Button color="grey" style={{display: "inline", border: (filterBy==="mf" ? "2px solid black" : "none") }} type="button" onClick={()=>setFilterBy("mf")}>MF</Button>
        <Button color="grey" style={{display: "inline", border: (filterBy==="bm7" ? "2px solid black" : "none") }} type="button" onClick={()=>setFilterBy("bm7")}>MS7 Plan</Button>
        <Button color="grey" style={{display: "inline", border: (filterBy==="bm7t" ? "2px solid black" : "none") }} type="button" onClick={()=>setFilterBy("bm7t")}>MS7 Cel</Button>
       </Button.Group>
        &nbsp;&nbsp;
        <Button color="black" style={{display: "inline"}} type="button" onClick={()=>handleChngeWeek("-")}><Icon name="arrow left" /></Button>
        &nbsp;{selectedDate.getFullYear().toString().substring(2,4) + " KW "+getWeek(selectedDate)}&nbsp;
        <Button color="black" style={{display: "inline"}} type="button" onClick={()=>handleChngeWeek("+")}><Icon name="arrow right" /></Button>
        &nbsp;&nbsp;&nbsp;<Modal open={legendaOpen} onOpen={()=>setLegendaOpen(true)} onClose={()=>setLegendaOpen(false)} trigger={<Button color="grey" onClick={()=>setLegendaOpen(true)}>Legenda</Button>}>
          <Modal.Header>Lista Zleceń - Legenda</Modal.Header>
          <Modal.Content>
            <Label color='blue'>Zlecenie linii Serwis</Label><br /><br />
            <Label color='green'>Zlecenie linii Nowe Formy</Label> <br /><br />
            <Label color='orange'>Zwykła operacja</Label><br /><br />
            <Label color='yellow'>Operacja na jednej z moich maszyn</Label><br /><br />
            <Label color='red'>Częściowo potwierdzone</Label><br />
          </Modal.Content>
          <Modal.Actions>
            <Button positive onClick={()=>setLegendaOpen(false)}>OK</Button>
          </Modal.Actions>
                    </Modal>
                    {rcu.id!=='a' && <Button color='purple' onClick={() => hadleModalOrNor()}>Do excela</Button>}
       
          <Button color='purple' icon as={Link} to={'/fifo/selfsettings'} style={{display: "inline", padding:0}}> <Icon size='tiny' name='settings' /> </Button>
          Filtr: <input type="text" name="fil" value={fifoFilter} onChange={(event)=>setFifoFilter(event.target.value)} size={5} />
        </Header>
      </div>
      <Grid style={{width:1500,height:100, marginTop:20}}>
       
      </Grid>
            {days.map(d=>(
                <Fragment key={d.name}>
                    <Header>{d.name+" "+(selectedDate.getDay()===d.num ? format(selectedDate,'yyyy-MM-dd') : (selectedDate.getDay()>d.num? format(subDays(selectedDate,Math.abs(selectedDate.getDay()-d.num)),'yyyy-MM-dd') : format(addDays(selectedDate,Math.abs(selectedDate.getDay()-d.num)),'yyyy-MM-dd')))+" Ilość: "+activeOrders?.filter(x=>getWeek(new Date((filterBy==="mf" ? x.mfPlan : x.bm7planDT)))===getWeek(selectedDate) 
            && (new Date((filterBy==="mf" ? x.mfPlan : (filterBy==="bm7" ? x.bm7planDT : x.bm7targetDT)))).getDay()===d.num && x.fifoNumber!=="0" 
            && (liniaFilter==="all" ? true : (liniaFilter===x.linia ? true : false)) 
            && nameFilter(x)
            && !checkELNames(x.matname)
            && !isElectrodeDivers(x)
            && (x.fifoNumber.includes(fifoFilter) || x.kwzNumber.includes(fifoFilter) || x.identNumber.includes(fifoFilter))
            ).length}                     
            </Header>
                    {/* .toISOString().split("T")[0] */}
            {activeOrders?.filter(x=>getWeek(new Date((filterBy==="mf" ? x.mfPlan : (filterBy==="bm7" ? x.bm7planDT : x.bm7targetDT))))===getWeek(selectedDate) 
            && (new Date((filterBy==="mf" ? x.mfPlan : (filterBy==="bm7" ? x.bm7planDT : x.bm7targetDT)))).getDay()===d.num && x.fifoNumber!=="0" 
            && (liniaFilter==="all" ? true : (liniaFilter===x.linia ? true : false)) 
            && nameFilter(x)
            && !checkELNames(x.matname)
            && !isElectrodeDivers(x)
            && (x.fifoNumber.includes(fifoFilter) || x.kwzNumber.includes(fifoFilter) || x.identNumber.includes(fifoFilter))
            ).sort((a,b)=>a.fifoNumber>b.fifoNumber?1:-1).map(a=>(
                <Fragment key={a.id}>
                    
                        <>
                        <Header size="small">
                    {/* {activeOrders.filter(x=>x.parentOrder===a.orderNumber).length>0 && <Button type="button" onClick={()=>setOpenOrder(openOrder===a.orderNumber ? "none" : a.orderNumber)}><Icon name={(openOrder===a.orderNumber ? "arrow up" : "arrow down")}/></Button>} */}
                        <Label color={a.linia==="skyblue" ? ( a.bu==="MetalPartsProduction(MPP)" ? "orange" : "blue") : "green"} onClick={()=>flipPriorytet(a)}>{a.priorytet && <Icon name='circle' color='red' />}{a.fifoNumber+" ("+a.orderNumber+")"}</Label> {activeOrders.filter(x=>x.parentOrder===a.orderNumber).length>0 && <Button type="button" onClick={()=>setOpenOrder(openOrder===a.orderNumber ? "none" : a.orderNumber)}><Icon name={(openOrder===a.orderNumber ? "arrow up" : "arrow down")}/></Button>}:
                    {a.planTimes.split(';').filter(x=>x.split(':')[0].length>0).sort((aa,bb)=>aa.split(':')[4]>bb.split(':')[4]?1:-1).map(x=>(
                        <Label key={x} style={{display:"inline", bordrer: (currentUser.fifoTS.includes(x.split(':')[0]) ? "5px solid black" : "none")}} color={(currentUser.fifoTS.includes(x.split(':')[0])) ? "yellow" : (x.split(':')[3]==="20" ? "orange" : "red")} title={(x.split(':')[3]==="20" ? "Nie rozpoczęte" : "Częściowo potwierdzone")}>{x.split(':')[0]} - {x.split(':')[2] ?  (x.split(':')[2].substring(0,char_amount)) : ""} {(currentUser.canGiveRed ? "- "+x.split(':')[1] : "")}</Label>
                    ))}
                    </Header>
                    <Segment style={{display: (openOrder===a.orderNumber ? "block" : "none")}}>
                        {activeOrders.filter(x=>x.parentOrder===a.orderNumber).map((b)=>(
                            <Fragment>
                             <Header size="small">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <Label color={b.linia==="skyblue" ? ( a.bu==="MetalPartsProduction(MPP)" ? "orange" : "blue"): "green"}>{b.fifoNumber+" ("+b.orderNumber+")"}</Label> :
                    {b.planTimes.split(';').filter(x=>x.split(':')[0].length>0).sort((aa,bb)=>aa.split(':')[4]>bb.split(':')[4]?1:-1).map(x=>(
                        <Label key={x} style={{display:"inline", bordrer: (currentUser.fifoTS.includes(x.split(':')[0]) ? "5px solid black" : "none")}} color={(currentUser.fifoTS.includes(x.split(':')[0])) ? "yellow" : (x.split(':')[3]==="20" ? "orange" : "red")} title={(x.split(':')[3]==="20" ? "Nie rozpoczęte" : "Częściowo potwierdzone")}>{x.split(':')[0]} - {x.split(':')[2].substring(0,char_amount)} {(currentUser.canGiveRed ? "- "+x.split(':')[1] : "")}</Label>
                    ))}
                    </Header>   
                            </Fragment>
                        ))}
                    </Segment>
                        </>
                    
                </Fragment>
                
            ))}
                 </Fragment>   
            ))}
            
        </Fragment>
    )
}
export default observer(OrderList);