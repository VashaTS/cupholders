using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;
using GTIS.Order.Contracts.ExportModels;
using Microsoft.Extensions.Configuration;

namespace Application.fifo
{
    public class getFifoOptWcf
    {
        public class Query : IRequest<List<FifoBox>>
        {
        }

        public class Handler : IRequestHandler<Query, List<FifoBox>>
        {
            
            private LocalData _context;
            private readonly IConfiguration _configuration;
            private readonly IHttpClientFactory _httpClientFactory;
            public Handler(LocalData context, IConfiguration configuration, IHttpClientFactory httpClientFactory)
            {
                _context = context;
                _configuration = configuration;
                _httpClientFactory = httpClientFactory;
            }
            public async Task<List<FifoBox>> Handle(Query request, CancellationToken cancellationToken)
            {
                var lupd = await _context.lfw.SingleOrDefaultAsync(); //get time of last wcf request
                 //?? new lastFromWcf { updTime = DateTime.Now.AddHours(-1) };
                

                var now = DateTime.Now;
                TimeSpan durr = now - lupd.updTime;
                if (durr.TotalMinutes > 6) //if last wcf update was more than 6 minutes ago
                {
                    Console.WriteLine("Needs REST API update");
                    var sett = await _context.Settings.SingleOrDefaultAsync();
                    lupd.updTime = now;
                    var success = await _context.SaveChangesAsync() > 0;
                    if (success)
                    {
                        var mach = await _context.Machines.ToListAsync();
                        // HttpClient client = new HttpClient();
                        // client.BaseAddress = new Uri("http://NTO-GTISP04:1923/export/digital-fifo-board/");
                        //HttpClient client = new HttpClient();
                        //client.BaseAddress = new Uri("https://nto-gtisp04.europe.phoenixcontact.com:1923/export/digital-fifo-board/");
                        //stopped dev-api stopped working mid june 2024
                        // client.BaseAddress = new Uri("https://dev-api.europe.phoenixcontact.com/gtis/nto-gtisp04/v1/export/digital-fifo-board/");
                        string gtisKey = _configuration["ApiKeys:GTIS"];
                        string apiKey = _configuration["ApiKeys:devportal"];
                        var client = _httpClientFactory.CreateClient("GTISClient");
                        client.DefaultRequestHeaders.Add("GTIS-Api-Key", gtisKey);
                        client.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key",apiKey);

                        using var resultOrders = await client.GetStreamAsync("orders/in-work/poland");
                        var list = await JsonSerializer.DeserializeAsync<List<ExportDataOrderPoland>>(resultOrders, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Received {(list?.Count ?? 0)} orders from GTIS API.");
                        await Task.Run(() =>
                        list.ForEach(delegate (ExportDataOrderPoland item)
                        {
                            if (!(item == null))
                            {
                                // Console.WriteLine(item.OrderNumber);
                                List<nextOperation> nwops = new List<nextOperation>();
                                List<nextOperation> gfops = new List<nextOperation>();
                                List<nextOperation> cuops = new List<nextOperation>();
                                String optimes = "";
                                String gfoptimes = "";
                                String cuoptimes = "";
                                String ts_50 = "";
                                item.Operations.ForEach(delegate (ExportDataOrderOperationPoland op)
                                {
                                    if (!(op == null))
                                    {
                                        if(!(op.Description==null)){ // c
                                            if (op.WorkplacePlan == "TS-50O") ts_50 = op.ConfirmationNumber+"";
                                            if (((op.Status == "20") || op.Status == "30") && (op.WorkplaceActual != "TS-50O") && !op.Description.Contains("[GF]") && !op.Description.Contains("[CU]"))
                                            {
                                                optimes = optimes + op.WorkplaceActual + ":" + op.TimePlan + ":" + op.Description + ":" + op.Status + ":" + op.OperationNumber + ":" + op.TimeActual + ":" + op.ConfirmationNumber + ";" ; //for calculating time plan 
                                                var nwop = new nextOperation
                                                {
                                                    Operation = op.WorkplaceActual.Contains("O") ? op.WorkplaceActual.Remove(op.WorkplaceActual.Length - 1) : op.WorkplaceActual,
                                                    opnr = op.OperationNumber,
                                                    Descr = op.Description.Replace(';','_').Replace(':','_'), //case of 
                                                };
                                                nwops.Add(nwop);
                                            }
                                            if (((op.Status == "20") || op.Status == "30") && (op.WorkplaceActual != "TS-50O") && op.Description.Contains("[GF]"))
                                            {
                                                gfoptimes = gfoptimes + op.WorkplaceActual + ":" + op.TimePlan + ":" + op.Description + ":" + op.Status + ":" + op.OperationNumber + ":" + op.TimeActual + ":" + op.ConfirmationNumber + ";"; //for calculating time plan 
                                                var nwop = new nextOperation
                                                {
                                                    Operation = op.WorkplaceActual.Contains("O") ? op.WorkplaceActual.Remove(op.WorkplaceActual.Length - 1) : op.WorkplaceActual,
                                                    opnr = op.OperationNumber,
                                                    Descr = op.Description.Replace(';', '_').Replace(':', '_'), //case of 
                                                };
                                                gfops.Add(nwop);
                                            }
                                            if (((op.Status == "20") || op.Status == "30") && (op.WorkplaceActual != "TS-50O") && op.Description.Contains("[CU]"))
                                            {
                                                cuoptimes = cuoptimes + op.WorkplaceActual + ":" + op.TimePlan + ":" + op.Description + ":" + op.Status + ":" + op.OperationNumber + ":" + op.TimeActual + ":" + op.ConfirmationNumber + ";"; //for calculating time plan 
                                                var nwop = new nextOperation
                                                {
                                                    Operation = op.WorkplaceActual.Contains("O") ? op.WorkplaceActual.Remove(op.WorkplaceActual.Length - 1) : op.WorkplaceActual,
                                                    opnr = op.OperationNumber,
                                                    Descr = op.Description.Replace(';', '_').Replace(':', '_'), //case of 
                                                };
                                                cuops.Add(nwop);
                                            }
                                        }
                                    }
                                });
                               string kli = "none";
                                if (nwops.Count > 0) //if order has any unfinished operations
                                {
                                    nwops.Sort((a, b) => a.opnr.CompareTo(b.opnr)); //sort operations by operation number
                                    if(item.ProjectDescription != null){
                                        if(item.ProjectDescription.Contains("(DC)")) kli="DC";
                                        if(item.ProjectDescription.Contains("(IC)")) kli="IC";
                                    }
                                    var curr = _context.FifoBoxes.FirstOrDefault((fi) => (fi.OrderNumber == item.OrderNumber.ToString()));
                                    if (curr == null) //new order
                                    {
                                        

                                        var nwfb = new FifoBox
                                        {
                                                OrderNumber = item.OrderNumber.ToString(),
                                                FifoNumber = item.FiFoNo.ToString(),
                                                KwzNumber = item.ProjectNumber,
                                                currentMachine = nwops[0].Operation.Contains("TS-") ? nwops[0].Operation : "TS-53",
                                                technolog = item.Planer,
                                                IdentNumber = item.MaterialNumber,
                                                Linia = (item.ShopFloor == "Serwis") ? sett.w1color : ((item.ShopFloor == "Nowe formy") ? sett.w2color : "white"),
                                                dotColor = (item.Bm7Plan != null) ? (((item.ProjectSize == "911" || item.ProjectSize == "909") && item.Bm7Plan > now.AddDays(14)) ? "yellow" : "transparent") : "transparent", //no dot by default
                                                DateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                DateDot = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                problem = "",
                                                keepAtMachine = "none", //machine according to gtis
                                                forDeletion = false,
                                                lastSeen = DateTime.Now,
                                                realDateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                konstruktor = item.Designer,
                                                bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now,
                                                bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now,
                                                matname = item.MaterialDescription,
                                                dotForCurrOpOnly = false,
                                                onMachine = false,
                                                opDescr = nwops[0].Descr.Replace(";","_"),
                                                projectSize = ((item.ProjectSize == null) ? "" : item.ProjectSize) + ":" + item.GtisId.ToString(),
                                                planTimes = optimes,
                                                ManualYellowDot = false, //always false on new order
                                                nonFifoOrder = 25,
                                                mfPlan = (item.BmMfPlan != null) ? (item.BmMfPlan ?? DateTime.Now) : DateTime.Now,
                                                parentOrder = item.ParentOrderNumber.ToString(),
                                                priorytet = false,
                                                bm3plan = (item.Bm3Plan != null) ? (item.Bm3Plan ?? DateTime.Now) : DateTime.Now,
                                                klient = kli,
                                                firstSeen = DateTime.Now,
                                                quantity = Convert.ToInt32(item.Quantity),
                                                Opis = item.ProjectDescription,
                                                bu = item.BusinessUnit,
                                                ts50oConfirm = ts_50,
                                                eskalLastChangeBy = "_"
                                        };
                                        
                                        _context.FifoBoxes.Add(nwfb);
                                    }
                                    else // existing order
                                    {
                                        var currEsk = _context.Eskalacje.FirstOrDefault((fi) => fi.orderNumber == curr.OrderNumber);
                                        if(currEsk != null){
                                            if((curr.bm7targetDT!=item.Bm7Target)||(curr.bm7planDT!=item.Bm7Plan)){
                                                currEsk.bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now;
                                                currEsk.bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now;
                                            }
                                        }

                                     if (!string.IsNullOrEmpty(curr.currentMachine) && !curr.currentMachine.Contains("TS-"))
                                    {
                                        curr.currentMachine = "TS-53";
                                    }
                                    curr.lastSeen = DateTime.Now; //to keep old orders hidden, to be removed from db later
                                    curr.FifoNumber = item.FiFoNo.ToString(); //in case the number is assigned later
                                    curr.KwzNumber = item.ProjectNumber; // in case it is ssignd in gtis later
                                    curr.Linia = (item.ShopFloor == "Serwis") ? sett.w1color : ((item.ShopFloor == "Nowe formy") ? sett.w2color : "white");
                                    curr.technolog = item.Planer;
                                    curr.konstruktor = item.Designer;
                                    curr.matname = item.MaterialDescription;        
                                    curr.projectSize = ((item.ProjectSize == null) ? "" : item.ProjectSize) + ":" + item.GtisId.ToString();
                                    curr.planTimes = optimes;
                                    curr.bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now;
                                    curr.bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now;
                                    curr.mfPlan = (item.BmMfPlan != null) ? (item.BmMfPlan ?? DateTime.Now) : DateTime.Now;
                                    curr.bm3plan = (item.Bm3Plan != null) ? (item.Bm3Plan ?? DateTime.Now) : DateTime.Now;
                                    curr.parentOrder = item.ParentOrderNumber.ToString();
                                    curr.klient = kli;
                                    curr.quantity = Convert.ToInt32(item.Quantity);
                                    curr.Opis = item.ProjectDescription;
                                    curr.bu = item.BusinessUnit;
                                    curr.ts50oConfirm = ts_50;
                                            
                                    if (curr.dotColor == "yellow" && sett.autoYD && !curr.ManualYellowDot && (curr.projectSize.Split(":")[0] == "911" || curr.projectSize.Split(":")[0] == "909" || curr.projectSize.Split(":")[0] == "904"))
                                    { //order where managing makes sense
                                        if (item.Bm7Plan != null)
                                        {
                                            if (item.Bm7Plan <= now.AddDays(10))
                                            {
                                                curr.dotColor = "transparent";

                                            }
                                        }

                                    }
                                    else if (curr.dotColor == "transparent" && sett.autoYD && !curr.ManualYellowDot && (curr.projectSize.Split(":")[0] == "911" || curr.projectSize.Split(":")[0] == "909" || curr.projectSize.Split(":")[0] == "904"))
                                    { //adding dots for existing orders
                                        if (item.Bm7Plan != null)
                                        {
                                            if (item.Bm7Plan > now.AddDays(14))
                                            {
                                                curr.dotColor = "yellow";
                                            }
                                        }
                                    }
                                            //change of TS
                                    if ((!(curr.currentMachine == nwops[0].Operation) || (curr.currentMachine=="TS-13" && !(curr.opDescr == nwops[0].Descr))) && curr.keepAtMachine == "none")
                                    {
                                        if (nwops.Count > 0)
                                        {
                                                    // Console.WriteLine(nwops[0].Operation);
                                        }
                                        else
                                        {
                                                    // Console.WriteLine("nwops count less than 0");
                                        }
                                                //check is past op is TS-22, and if so save new KonstrLeadTime
                                        if (curr.currentMachine == "TS-22")
                                        {
                                            var nlk = new KonstrLeadTime
                                            {
                                                        orderNumber = curr.OrderNumber + ":" + curr.projectSize,
                                                        fifoNumber = curr.FifoNumber,
                                                        person = curr.konstruktor,
                                                        dateStart = curr.realDateEntry,
                                                        dteEnd = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                        kwzNumber = curr.KwzNumber,
                                                        identNumber = curr.IdentNumber
                                            };
                                             _context.KonstrLeadTimes.Add(nlk);
                                        }
                                        if (curr.currentMachine == "TS-13" && curr.opDescr.ToLower().Contains("projektowanie"))
                                        {
                                            var nprl = new ProjLeadTime
                                            {
                                                    orderNumber = curr.OrderNumber + ":" + curr.projectSize,
                                                    fifoNumber = curr.FifoNumber,
                                                    person = curr.konstruktor,
                                                    dateStart = curr.realDateEntry,
                                                    dteEnd = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                    kwzNumber = curr.KwzNumber,
                                                    identNumber = curr.IdentNumber
                                            };
                                            _context.ProjLeadTimes.Add(nprl);
                                        }
                                                //check if the machines are in the same group, and then remove dot if needed
                                        if (!(nwops is null))
                                        {
                                            if (!(mach is null))
                                            {
                                                if (!(nwops[0].Operation is null))
                                                {
                                                    if (nwops[0].Operation.Contains("TS-"))
                                                    {
                                                        if (!(mach.FirstOrDefault(x => x.tsName == curr.currentMachine).type == mach.FirstOrDefault(x => x.tsName == nwops[0].Operation).type))
                                                        {
                                                                    // Console.WriteLine("here!");
                                                                    //different machine type, so remove dot if requested
                                                            if (curr.dotForCurrOpOnly)
                                                            {
                                                                curr.dotColor = "transparent"; //do not care for previous dot color
                                                            }       
                                                        }
                                                    }
                                                    else
                                                    {
                                                                // Console.WriteLine("Operation empty, but not null: New machine not yet in GTIS?");
                                                    }
                                                }
                                                else
                                                {
                                                            // Console.WriteLine("Operation null");
                                                }
                                            }
                                            else
                                            {
                                                        // Console.WriteLine("mach is null");
                                            }
                                        }
                                        else
                                        {
                                                    // Console.WriteLine("nwops is null!");
                                        }
                                        curr.realDateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                                        curr.DateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"); //so it gets added to the end of the list on next machine.
                                        curr.onMachine = false; //no order immidiately goes into next machine
                                        curr.opDescr = nwops[0].Descr.Replace(";", "_"); //for manual TS changes in client
                                        if (!(curr.dotColor == "transparent"))
                                        {
                                            var ne = new dotEntry
                                            {
                                                    forTS = curr.currentMachine,
                                                    dotColor = curr.dotColor,
                                                    changedBy = "movedto",
                                                    opName = curr.opDescr,
                                                    dateDot = DateTime.Now,
                                                    orderNumber = curr.OrderNumber
                                            };
                                            _context.DotEntries.Add(ne);
                                        }    
                                    } //change of TS
                                    //check if operation that was manaully changed to is finished in GTIS data
                                    if (curr.keepAtMachine == curr.currentMachine)
                                    {
                                        var opexists = false;
                                        nwops.ForEach(delegate (nextOperation no)
                                        {
                                            if (no.Operation == curr.keepAtMachine)
                                            {
                                                opexists = true;
                                            }
                                        });
                                        if (!opexists) //opefation that was manually  oved into is finished
                                        {
                                            curr.currentMachine = nwops[0].Operation; //back to planned operation order
                                            curr.opDescr = nwops[0].Descr.Replace(";", "_");
                                            curr.keepAtMachine = "none"; //to avoid not needed calculation in future
                                            curr.onMachine = false;
                                        }
                                        else
                                        {
                                                    //if it exists, do not change currentMachine, only update lastseen etc
                                                    //this is the case most of the time

                                        }
                                    }
                                    else
                                    { //if there is no manually set machine, do not bother checking, just update according to GTIS
                                        curr.currentMachine = nwops[0].Operation;
                                        curr.opDescr = nwops[0].Descr.Replace(";", "_");
                                    }       
                                    }
                                 
                                   
                                }
                                else
                            { //every operation finished...
                                var curr = _context.FifoBoxes.FirstOrDefault((fi) => (fi.OrderNumber == item.OrderNumber.ToString()));
                                if (curr != null)
                                { // ...but exists in db
                                    //_context.FifoBoxes.Remove(curr); 
                                    curr.forDeletion = true;
                                    curr.currentMachine = "TS-00"; //to remove it from last machine before db deletion, which can happen later
                                                                           // Console.WriteLine("Order: "+curr.OrderNumber+" needs to be removed (all operations finished)");
                                }
                            }
                    
                            
                                //[GF]
                            if (gfops.Count > 0) //if order has any unfinished operations
                            {
                                    //Console.WriteLine("Elektroda");
                                var electrodeKey = item.OrderNumber.ToString() + "EL";
                                gfops.Sort((a, b) => a.opnr.CompareTo(b.opnr)); //sort operations by operation number
                                if(item.ProjectDescription != null){
                                        if(item.ProjectDescription.Contains("(DC)")) kli="DC";
                                        if(item.ProjectDescription.Contains("(IC)")) kli="IC";
                                    }
                                var curr = _context.FifoBoxes.FirstOrDefault(fi => fi.OrderNumber == electrodeKey);
                                if (curr == null) //new order
                                {
                                 
                                    var nwfb = new FifoBox
                                    {
                                        OrderNumber = item.OrderNumber.ToString()+"EL",
                                        FifoNumber = item.FiFoNo.ToString(),
                                        KwzNumber = item.ProjectNumber,
                                        currentMachine = gfops[0].Operation.Contains("TS-") ? gfops[0].Operation : "TS-53",
                                        technolog = item.Planer,
                                        IdentNumber = item.MaterialNumber,
                                        Linia = (item.ShopFloor == "Serwis") ? sett.w1color : ((item.ShopFloor == "Nowe formy") ? sett.w2color : "white"),
                                        dotColor = (item.Bm7Plan != null) ? (((item.ProjectSize == "911" || item.ProjectSize == "909") && item.Bm7Plan > now.AddDays(14)) ? "yellow" : "transparent") : "transparent", //no dot by default
                                        DateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                        DateDot = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                        problem = "",
                                        keepAtMachine = "none", //machine according to gtis
                                        forDeletion = false,
                                        lastSeen = DateTime.Now,
                                        realDateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                        konstruktor = item.Designer,
                                        bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now,
                                        bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now,
                                        matname = item.MaterialDescription,
                                        dotForCurrOpOnly = false,
                                        onMachine = false,
                                        opDescr = gfops[0].Descr.Replace(";", "_"),
                                        projectSize = ((item.ProjectSize == null) ? "" : item.ProjectSize) + ":" + item.GtisId.ToString(),
                                        planTimes = gfoptimes,
                                        ManualYellowDot = false, //always false on new order
                                        nonFifoOrder = 25,
                                        mfPlan = (item.BmMfPlan != null) ? (item.BmMfPlan ?? DateTime.Now) : DateTime.Now,
                                        parentOrder = item.ParentOrderNumber.ToString(),
                                        priorytet = false,
                                        bm3plan = (item.Bm3Plan != null) ? (item.Bm3Plan ?? DateTime.Now) : DateTime.Now,
                                        klient = kli,
                                        firstSeen = DateTime.Now,
                                        quantity = Convert.ToInt32(item.Quantity),
                                        Opis = item.ProjectDescription,
                                        bu = item.BusinessUnit,
                                        ts50oConfirm = ts_50,
                                        eskalLastChangeBy = "_"
                                    };
                                        // Console.WriteLine(item.Planer);
                                     _context.FifoBoxes.Add(nwfb);
                                }
                                else // existing order
                                {
                                    var currEsk = _context.Eskalacje.FirstOrDefault((fi) => fi.orderNumber == curr.OrderNumber);
                                    if (currEsk != null)
                                    {
                                        if ((curr.bm7targetDT != item.Bm7Target) || (curr.bm7planDT != item.Bm7Plan))
                                        {
                                            currEsk.bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now;
                                            currEsk.bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now;
                                        }
                                    }
                                    if (!curr.currentMachine.Contains("TS-"))
                                    {
                                        curr.currentMachine = "TS-53";
                                    }
                                    curr.lastSeen = DateTime.Now; //to keep old orders hidden, to be removed from db later
                                    curr.FifoNumber = item.FiFoNo.ToString(); //in case the number is assigned later
                                    curr.KwzNumber = item.ProjectNumber; // in case it is ssignd in gtis later
                                    curr.Linia = (item.ShopFloor == "Serwis") ? sett.w1color : ((item.ShopFloor == "Nowe formy") ? sett.w2color : "white");
                                    curr.technolog = item.Planer;
                                    curr.konstruktor = item.Designer;
                                    curr.matname = item.MaterialDescription;    
                                    curr.projectSize = ((item.ProjectSize == null) ? "" : item.ProjectSize) + ":" + item.GtisId.ToString();
                                    curr.planTimes = gfoptimes;
                                    curr.bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now;
                                    curr.bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now;
                                    curr.mfPlan = (item.BmMfPlan != null) ? (item.BmMfPlan ?? DateTime.Now) : DateTime.Now;
                                    curr.bm3plan = (item.Bm3Plan != null) ? (item.Bm3Plan ?? DateTime.Now) : DateTime.Now;
                                    curr.parentOrder = item.ParentOrderNumber.ToString();
                                    curr.klient = kli;
                                    curr.quantity = Convert.ToInt32(item.Quantity);
                                    curr.Opis = item.ProjectDescription;
                                    curr.bu = item.BusinessUnit;
                                    curr.ts50oConfirm = ts_50;

                                    if (curr.dotColor == "yellow" && sett.autoYD && !curr.ManualYellowDot && (curr.projectSize.Split(":")[0] == "911" || curr.projectSize.Split(":")[0] == "909" || curr.projectSize.Split(":")[0] == "904"))
                                    { //order where managing makes sense
                                        if (item.Bm7Plan != null)
                                        {
                                            if (item.Bm7Plan <= now.AddDays(10))
                                            {
                                                curr.dotColor = "transparent";
                                            }
                                        }
                                    }
                                    else if (curr.dotColor == "transparent" && sett.autoYD && !curr.ManualYellowDot && (curr.projectSize.Split(":")[0] == "911" || curr.projectSize.Split(":")[0] == "909" || curr.projectSize.Split(":")[0] == "904"))
                                    { //adding dots for existing orders
                                        if (item.Bm7Plan != null)
                                        {
                                            if (item.Bm7Plan > now.AddDays(14))
                                            {
                                                curr.dotColor = "yellow";
                                            }
                                        }
                                    }
                                        //change of TS
                                    if ((!(curr.currentMachine == gfops[0].Operation) || (curr.currentMachine == "TS-13" && !(curr.opDescr == gfops[0].Descr))) && curr.keepAtMachine == "none")
                                    {
                                            //check is past op is TS-22, and if so save new KonstrLeadTime
                                        if (curr.currentMachine == "TS-22")
                                        {
                                            var nlk = new KonstrLeadTime
                                            {
                                                orderNumber = curr.OrderNumber + ":" + curr.projectSize,
                                                fifoNumber = curr.FifoNumber,
                                                person = curr.konstruktor,
                                                dateStart = curr.realDateEntry,
                                                dteEnd = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                kwzNumber = curr.KwzNumber,
                                                identNumber = curr.IdentNumber
                                            };
                                            _context.KonstrLeadTimes.Add(nlk);
                                        }
                                        if (curr.currentMachine == "TS-13" && curr.opDescr.ToLower().Contains("projektowanie"))
                                        {
                                            var nprl = new ProjLeadTime
                                            {
                                                orderNumber = curr.OrderNumber + ":" + curr.projectSize,
                                                fifoNumber = curr.FifoNumber,
                                                person = curr.konstruktor,
                                                dateStart = curr.realDateEntry,
                                                dteEnd = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                kwzNumber = curr.KwzNumber,
                                                identNumber = curr.IdentNumber
                                            };
                                            _context.ProjLeadTimes.Add(nprl);
                                        }
                                            //check if the machines are in the same group, and then remove dot if needed
                                        if (!(gfops is null))
                                        {
                                            if (!(mach is null))
                                            {
                                                if (!(gfops[0].Operation is null))
                                                {
                                                    if (gfops[0].Operation.Contains("TS-"))
                                                    {
                                                        if (!(mach.FirstOrDefault(x => x.tsName == curr.currentMachine).type == mach.FirstOrDefault(x => x.tsName == gfops[0].Operation).type))
                                                        {
                                                                //different machine type, so remove dot if requested
                                                            if (curr.dotForCurrOpOnly)
                                                            {
                                                                curr.dotColor = "transparent"; //do not care for previous dot color
                                                            }
                                                        }
                                                    }
                                                    else
                                                    {
                                                            // Console.WriteLine("Operation empty, but not null: New machine not yet in GTIS?");
                                                    }
                                                }
                                                else
                                                {
                                                        // Console.WriteLine("Operation null");
                                                }
                                            }
                                            else
                                            {
                                                    // Console.WriteLine("mach is null");
                                            }
                                        }
                                        else
                                        {
                                                // Console.WriteLine("nwops is null!");
                                        }

                                        curr.realDateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                                        curr.DateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"); //so it gets added to the end of the list on next machine.
                                        curr.onMachine = false; //no order immidiately goes into next machine
                                        curr.opDescr = gfops[0].Descr.Replace(";", "_"); //for manual TS changes in client
                                        if (!(curr.dotColor == "transparent"))
                                        {
                                            var ne = new dotEntry
                                            {
                                                forTS = curr.currentMachine,
                                                dotColor = curr.dotColor,
                                                changedBy = "movedto",
                                                opName = curr.opDescr,
                                                dateDot = DateTime.Now,
                                                orderNumber = curr.OrderNumber
                                            };
                                            _context.DotEntries.Add(ne);
                                        }
                                    }
                                        //check if operation that was manaully changed to is finished in GTIS data
                                    if (curr.keepAtMachine == curr.currentMachine)
                                    {
                                        var opexists = false;
                                        gfops.ForEach(delegate (nextOperation no)
                                        {
                                            if (no.Operation == curr.keepAtMachine)
                                            {
                                                opexists = true;
                                            }
                                        });
                                        if (!opexists) //opefation that was manually  moved into is finished
                                        {
                                            curr.currentMachine = gfops[0].Operation; //back to planned operation order
                                            curr.opDescr = gfops[0].Descr.Replace(";", "_");
                                            curr.keepAtMachine = "none"; //to avoid not needed calculation in future
                                            curr.onMachine = false;
                                        }
                                        else
                                        {
                                                //if it exists, do not change currentMachine, only update lastseen etc
                                                //this is the case most of the time

                                        }
                                    }
                                    else
                                    { //if there is no manually set machine, do not bother checking, just update according to GTIS
                                        curr.currentMachine = gfops[0].Operation;
                                        curr.opDescr = gfops[0].Descr.Replace(";", "_");
                                    }
                                }
                            }
                            else
                            { //every operation finished...
                                var electrodeKey = item.OrderNumber.ToString() + "EL";
                                var curr = _context.FifoBoxes.FirstOrDefault((fi) => (fi.OrderNumber == electrodeKey));
                                if (curr != null)
                                { // ...but exists in db
                                      //_context.FifoBoxes.Remove(curr); 
                                    curr.forDeletion = true;
                                    curr.currentMachine = "TS-00"; //to remove it from last machine before db deletion, which can happen later
                                                                       // Console.WriteLine("Order: "+curr.OrderNumber+" needs to be removed (all operations finished)");
                                }
                            }
                                //[CU]
                            if (cuops.Count > 0) //if order has any unfinished operations
                            {
                                    //Console.WriteLine("Elektroda");
                                var electrodeKey = item.OrderNumber.ToString() + "CU";
                                cuops.Sort((a, b) => a.opnr.CompareTo(b.opnr)); //sort operations by operation number
                                if(item.ProjectDescription != null){
                                        if(item.ProjectDescription.Contains("(DC)")) kli="DC";
                                        if(item.ProjectDescription.Contains("(IC)")) kli="IC";
                                    }
                                var curr = _context.FifoBoxes.FirstOrDefault(fi => fi.OrderNumber == electrodeKey);
                                if (curr == null) //new order
                                {
                                    var nwfb = new FifoBox
                                    {
                                        OrderNumber = item.OrderNumber.ToString() + "CU",
                                        FifoNumber = item.FiFoNo.ToString(),
                                        KwzNumber = item.ProjectNumber,
                                        currentMachine = cuops[0].Operation.Contains("TS-") ? cuops[0].Operation : "TS-53",
                                        technolog = item.Planer,
                                        IdentNumber = item.MaterialNumber,
                                        Linia = (item.ShopFloor == "Serwis") ? sett.w1color : ((item.ShopFloor == "Nowe formy") ? sett.w2color : "white"),
                                        dotColor = (item.Bm7Plan != null) ? (((item.ProjectSize == "911" || item.ProjectSize == "909") && item.Bm7Plan > now.AddDays(14)) ? "yellow" : "transparent") : "transparent", //no dot by default
                                        DateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                        DateDot = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                        problem = "",
                                        keepAtMachine = "none", //machine according to gtis
                                        forDeletion = false,
                                        lastSeen = DateTime.Now,
                                        realDateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                        konstruktor = item.Designer,
                                        bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now,
                                        bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now,
                                        matname = item.MaterialDescription,
                                        dotForCurrOpOnly = false,
                                        onMachine = false,
                                        opDescr = cuops[0].Descr.Replace(";", "_"),
                                        projectSize = ((item.ProjectSize == null) ? "" : item.ProjectSize) + ":" + item.GtisId.ToString(),
                                        planTimes = cuoptimes,
                                        ManualYellowDot = false, //always false on new order
                                        nonFifoOrder = 25,
                                        mfPlan = (item.BmMfPlan != null) ? (item.BmMfPlan ?? DateTime.Now) : DateTime.Now,
                                        parentOrder = item.ParentOrderNumber.ToString(),
                                        priorytet = false,
                                        bm3plan = (item.Bm3Plan != null) ? (item.Bm3Plan ?? DateTime.Now) : DateTime.Now,
                                        klient = kli,
                                        firstSeen = DateTime.Now,
                                        quantity = Convert.ToInt32(item.Quantity),
                                        Opis = item.ProjectDescription,
                                        bu = item.BusinessUnit,
                                        ts50oConfirm = ts_50,
                                        eskalLastChangeBy = "_"
                                    };
                                        // Console.WriteLine(item.Planer);
                                    _context.FifoBoxes.Add(nwfb);
                                }
                                else // existing order
                                {
                                    var currEsk = _context.Eskalacje.FirstOrDefault((fi) => fi.orderNumber == curr.OrderNumber);
                                    if (currEsk != null)
                                    {
                                        if ((curr.bm7targetDT != item.Bm7Target) || (curr.bm7planDT != item.Bm7Plan))
                                        {
                                            currEsk.bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now;
                                            currEsk.bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now;
                                        }
                                    }
                                    if (!curr.currentMachine.Contains("TS-"))
                                    {
                                        curr.currentMachine = "TS-53";
                                    }
                                    curr.lastSeen = DateTime.Now; //to keep old orders hidden, to be removed from db later
                                    curr.FifoNumber = item.FiFoNo.ToString(); //in case the number is assigned later
                                    curr.KwzNumber = item.ProjectNumber; // in case it is ssignd in gtis later
                                    curr.Linia = (item.ShopFloor == "Serwis") ? sett.w1color : ((item.ShopFloor == "Nowe formy") ? sett.w2color : "white");
                                    curr.technolog = item.Planer;
                                    curr.konstruktor = item.Designer;
                                    curr.matname = item.MaterialDescription;                                      
                                    curr.projectSize = ((item.ProjectSize == null) ? "" : item.ProjectSize) + ":" + item.GtisId.ToString();
                                    curr.planTimes = cuoptimes;
                                    curr.bm7planDT = (item.Bm7Plan != null) ? (item.Bm7Plan ?? DateTime.Now) : DateTime.Now;
                                    curr.bm7targetDT = (item.Bm7Target != null) ? (item.Bm7Target ?? DateTime.Now) : DateTime.Now;
                                    curr.mfPlan = (item.BmMfPlan != null) ? (item.BmMfPlan ?? DateTime.Now) : DateTime.Now;
                                    curr.bm3plan = (item.Bm3Plan != null) ? (item.Bm3Plan ?? DateTime.Now) : DateTime.Now;
                                    curr.parentOrder = item.ParentOrderNumber.ToString();
                                    curr.klient = kli;
                                    curr.quantity = Convert.ToInt32(item.Quantity);
                                    curr.Opis = item.ProjectDescription;
                                    curr.bu = item.BusinessUnit;
                                    curr.ts50oConfirm = ts_50;

                                    if (curr.dotColor == "yellow" && sett.autoYD && !curr.ManualYellowDot && (curr.projectSize.Split(":")[0] == "911" || curr.projectSize.Split(":")[0] == "909" || curr.projectSize.Split(":")[0] == "904"))
                                    { //order where managing makes sense
                                        if (item.Bm7Plan != null)
                                        {
                                            if (item.Bm7Plan <= now.AddDays(10))
                                            {
                                                curr.dotColor = "transparent";
                                            }
                                        }
                                    }
                                    else if (curr.dotColor == "transparent" && sett.autoYD && !curr.ManualYellowDot && (curr.projectSize.Split(":")[0] == "911" || curr.projectSize.Split(":")[0] == "909" || curr.projectSize.Split(":")[0] == "904"))
                                    { //adding dots for existing orders
                                        if (item.Bm7Plan != null)
                                        {
                                            if (item.Bm7Plan > now.AddDays(14))
                                            {
                                                curr.dotColor = "yellow";
                                            }
                                        }
                                    }
                                    //change of TS
                                    if ((!(curr.currentMachine == cuops[0].Operation) || (curr.currentMachine == "TS-13" && !(curr.opDescr == cuops[0].Descr))) && curr.keepAtMachine == "none")
                                    {
                                            //check is past op is TS-22, and if so save new KonstrLeadTime
                                        if (curr.currentMachine == "TS-22")
                                        {
                                            var nlk = new KonstrLeadTime
                                            {
                                                orderNumber = curr.OrderNumber + ":" + curr.projectSize,
                                                fifoNumber = curr.FifoNumber,
                                                person = curr.konstruktor,
                                                dateStart = curr.realDateEntry,
                                                dteEnd = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                kwzNumber = curr.KwzNumber,
                                                identNumber = curr.IdentNumber
                                            };
                                            _context.KonstrLeadTimes.Add(nlk);
                                        }
                                        if (curr.currentMachine == "TS-13" && curr.opDescr.ToLower().Contains("projektowanie"))
                                        {
                                            var nprl = new ProjLeadTime
                                            {
                                                orderNumber = curr.OrderNumber + ":" + curr.projectSize,
                                                fifoNumber = curr.FifoNumber,
                                                person = curr.konstruktor,
                                                dateStart = curr.realDateEntry,
                                                dteEnd = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                                                kwzNumber = curr.KwzNumber,
                                                identNumber = curr.IdentNumber
                                            };
                                            _context.ProjLeadTimes.Add(nprl);
                                        }
                                        //check if the machines are in the same group, and then remove dot if needed
                                        if (!(cuops is null))
                                        {
                                            if (!(mach is null))
                                            {
                                                if (!(cuops[0].Operation is null))
                                                {
                                                    if (cuops[0].Operation.Contains("TS-"))
                                                    {
                                                        if (!(mach.FirstOrDefault(x => x.tsName == curr.currentMachine).type == mach.FirstOrDefault(x => x.tsName == cuops[0].Operation).type))
                                                        {
                                                                //different machine type, so remove dot if requested
                                                            if (curr.dotForCurrOpOnly)
                                                            {
                                                                curr.dotColor = "transparent"; //do not care for previous dot color
                                                            }
                                                        }
                                                    }
                                                    else
                                                    {
                                                        // Console.WriteLine("Operation empty, but not null: New machine not yet in GTIS?");
                                                    }
                                                }
                                                else
                                                {
                                                        // Console.WriteLine("Operation null");
                                                }
                                            }
                                            else
                                            {
                                                // Console.WriteLine("mach is null");
                                            }
                                        }
                                        else
                                        {
                                            // Console.WriteLine("nwops is null!");
                                        }
                                        curr.realDateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                                        curr.DateEntry = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"); //so it gets added to the end of the list on next machine.
                                        curr.onMachine = false; //no order immidiately goes into next machine
                                        curr.opDescr = cuops[0].Descr.Replace(";", "_"); //for manual TS changes in client
                                        if (!(curr.dotColor == "transparent"))
                                        {
                                            var ne = new dotEntry
                                            {
                                                forTS = curr.currentMachine,
                                                dotColor = curr.dotColor,
                                                changedBy = "movedto",
                                                opName = curr.opDescr,
                                                dateDot = DateTime.Now,
                                                orderNumber = curr.OrderNumber
                                            };
                                            _context.DotEntries.Add(ne);
                                        }                                          
                                    }
                                        //check if operation that was manaully changed to is finished in GTIS data
                                    if (curr.keepAtMachine == curr.currentMachine)
                                    {
                                        var opexists = false;
                                        cuops.ForEach(delegate (nextOperation no)
                                        {
                                            if (no.Operation == curr.keepAtMachine)
                                            {
                                                opexists = true;
                                            }
                                        });
                                        if (!opexists) //opefation that was manually  moved into is finished
                                        {
                                            curr.currentMachine = cuops[0].Operation; //back to planned operation order
                                            curr.opDescr = cuops[0].Descr.Replace(";", "_");
                                            curr.keepAtMachine = "none"; //to avoid not needed calculation in future
                                            curr.onMachine = false;
                                        }
                                        else
                                        {
                                                //if it exists, do not change currentMachine, only update lastseen etc
                                                //this is the case most of the time
                                        }
                                    }
                                    else
                                    { //if there is no manually set machine, do not bother checking, just update according to GTIS
                                        curr.currentMachine = cuops[0].Operation;
                                        curr.opDescr = cuops[0].Descr.Replace(";", "_");
                                    }
                                }
                            }
                            else
                            { //every operation finished...
                                var electrodeKey = item.OrderNumber.ToString() + "CU";
                                var curr = _context.FifoBoxes.FirstOrDefault((fi) => (fi.OrderNumber == electrodeKey));
                                if (curr != null)
                                { // ...but exists in db
                                      //_context.FifoBoxes.Remove(curr); 
                                    curr.forDeletion = true;
                                    curr.currentMachine = "TS-00"; //to remove it from last machine before db deletion, which can happen later
                                                                      // Console.WriteLine("Order: "+curr.OrderNumber+" needs to be removed (all operations finished)");
                                }
                            }
                            }
                        }));
                        
                    
                        

                        var success2 = await _context.SaveChangesAsync() > 0;
                        if (success2) Console.WriteLine("REST API update successful!");
                        Console.WriteLine(DateTime.Now);
                    }
                    else
                    {
                        Console.WriteLine("Problem updating");
                    }
                }
                Console.WriteLine("end.");
                var fb = await _context.FifoBoxes.ToListAsync();
                return fb;
            }
        }
    }
}