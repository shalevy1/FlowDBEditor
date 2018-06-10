/*jshint esversion: 6 */
/* FlowDBEditor content can load from (maybe automatically)
    GET parameter, 
    localstorage, 
    local file, 
    server file, 
    inbuilt

  Flowdbeditor start process
  1. If has flowdbeditor GET (flowdb) then load from     
    2. If no GET> examine INBUILT string (flowdbinit) and 
      2a if content: then load it
      2b if file path: then upload from server side and load it
      
        3. If no inbuilt> Load TEMP! localstorage

  With the LOAD button you can load FLOW! localstorage.
  Difference beetween FLOW vs TEMP localstorage:
    TEMP localstorage store automatically (all change and) the latest version without press button
    FLOW localstorage store if you press SAVE button

  so. if the next time you can continue editing where you abandoned. :)
*/

var params = (new URL(document.location)).searchParams;
var flowdbget = params.get("flowdb");     
var flowdbplayer = params.get("player");  //USERVIEW if exists
var ViewModes = Object.freeze({"Developer":1, "User":2});
var VIEWMODE=ViewModes.Developer;
if (flowdbplayer!=null){
  VIEWMODE=ViewModes.User;
}
//var flowdbinit=null; //if exists please remove this line flowdbinit is a innercircle start flowdb if you want
var temp="flowdbeditor_temp";        
var AUTOINCTSTART=1;
function flowdbeditor_onload(){
  var but=document.getElementById("flowdbload");
  but.activ=false; //TODO!!! for prevent to double load in same time
  if (flowdbget!=null){
    LoadString(flowdbget);
    but.activ=true;
  } else {  
    if (flowdbinit==null){
      Load(temp);
      but.activ=true;
    }
    else //compact
    {
      if ( !flowdbinit.startsWith("<flow" )) {
        //TODO load serverside file to flowdbinit
        document.getElementById("loadserverdefault").style.display="flex";
        LoadServerDefault();
      } else {
        LoadString(flowdbinit); 
        but.activ=true;     
      }
    }
  }
  document.body.addEventListener("paste", PastePanel);
  newsdialog();
  addModules(document.getElementById("modules"));
}

var g = document.getElementsByName("table");
var flowdbeditor = document.getElementById("flowdbeditor");

for (let i = 0; i < g.length; i++) {
  const obj = g[i];
  obj.setAttribute("transform","translate(100,100)");
  obj.addEventListener("mousedown",down);
  obj.addEventListener("mousemove",move);
  obj.addEventListener("mouseup",up);
}

var zooms=[1200,2400,3200];
var zoomvalue=1;
function zoom(){
  if ((zoomvalue++)>2) zoomvalue=0;  
  flowdbeditor.setAttribute("viewBox","0 0 "+zooms[zoomvalue]+" "+zooms[zoomvalue]);
}

//#region HINTS, NEWS

function newsdialog(show){
  if (news==null) return; //defined in INDEX.html
  if (show){
    localStorage.setItem("flowdbeditornews","");
  }
  var newsul = document.getElementById("newsul");
  newsul.innerHTML="";
  var news1 = localStorage.getItem("flowdbeditornews");
  var shownews=false;
  var p=null;        
  for(let i=0;i<news.length;i++){ 
      if (news1!=null)
        p=news1.indexOf(news[i][0]);
      if (news1==null ||  (p<0)) {
        var d = document.createElement("li");
        d.innerHTML=news[i][1];
        newsul.appendChild(d);
        shownews=true;        
        news1+=""+news[i][0];
      }
  }  
  if (shownews){
    localStorage.setItem("flowdbeditornews",news1);
    var newsdom = document.getElementById("news");
    newsdom.style.visibility="visible";
  }
}


var noSelectedStyle = "fill:grey;stroke:black;stroke-width:1;opacity:0.5;cursor: all-scroll;";
var noSelectedStyle_readonly = "fill:yellow;stroke:black;stroke-width:1;opacity:0.5;cursor: all-scroll;";
var selectedStyle = "fill:blue;stroke:#000099;stroke-width:3;opacity:0.4;cursor: all-scroll;";
var fieldRowHeight = convertRemToPixels(1);//rem
var fieldRowPadding = fieldRowHeight/2;
var stateEdit = false;
var constraintList = true; //The list of record contain field values from another linked table


var oncehints = [];
oncehints.NewLinkFromPanel="Please select an another field name.";
oncehints.NewLink="Please select first a field name and after click an another field name.";
oncehints.outside="Reposition missed tables.";
oncehints.save="Save to browsers' local storage.\nIn the next time you can load this.";
oncehints.load="Loaded latest stored database from localstorage.";
oncehints.loadfromfile="Loaded database from file.";
oncehints.loadserverdefault="Default content loaded from server";
oncehints.hint = function(hint){
  if (oncehints[hint]!=""){
    document.getElementById("help").innerHTML=oncehints[hint];
    oncehints[hint]="";
  }
};

//#endregion HINTS, NEWS

var idTable=0;
var TTable = function(name){  
  this.posxy=[100,100]; //in px  
  this.width=200;
  this.height=200;
  this.AFields = []; //Tfield  
  this.Records = [];  //realtime upfill
  this.readonly = false;
  this.visible=true;
  this.description="";
  this.color="#888888";  

  this.DOMGroup=null; //teljese Table
    this.DOMtitle=null;
    this.DOMContextmenu=null;
    this.DOMrect=null;
    this.DOMFieldsGroup=null; //fields    
  

  this.setReadOnly = function(value){
    this.readonly=value;
    if (this.DOMrect){
      if (SelectedTable!=this){
        if (this.readonly)
          this.DOMrect.setAttribute("style",noSelectedStyle_readonly);
        else {
          this.DOMrect.setAttribute("style",noSelectedStyle);
          this.DOMrect.style.fill=this.color;
        }
      } else {
        this.DOMrect.setAttribute("style",selectedStyle);
      }
    }
  };  
  this.setColor=function(value){
    this.color=value;
  };
  this.setDescription=function(value){    
    this.description=nullstring(value);
  };
  this.setVisible=function(value){
    this.visible=value;
    if (this.visible){
      if (this.DOMGroup!=null)
        this.DOMGroup.style.visibility="visible";        
    }else {
      if (this.DOMGroup!=null)
        this.DOMGroup.style.visibility="hidden";
    }
    this.refreshConstraints();
  };

  this.moveToPosition=function(x,y){
      x = Math.floor(x);
      y = Math.floor(y);
      var s = "translate("+x+","+y+")";
      this.DOMGroup.setAttribute("transform",s);
      this.setPosXY(x,y);
      this.refreshConstraints();
  };

  this.setName=function(name){
    this.name=name;
    if (this.DOMtitle!=null) 
      this.DOMtitle.innerHTML=name;
  };
  this.setName(name+(idTable++));
  this.addField = function(name,type){
    var f = new TField(this,name);    
    f.type=type;
    var AF= this.AFields;
    this.AFields.push(f);    
    this.Records.forEach(function(o,i){
      if (i==0){
        o.push(AF[AF.length-1].name);
      } else {
        o.push(null);
      }
    });
    return f;
  };
  this.setPosXY=function(x,y){
    this.posxy[0]=x;
    this.posxy[1]=y;
  };
  this.getDOM=function(){
    this.DOMGroup=document.createElementNS("http://www.w3.org/2000/svg","g");
    this.DOMGroup.table=this;
    this.DOMrect=document.createElementNS("http://www.w3.org/2000/svg","rect");
    this.DOMrect.setAttribute("name","table");
    //this.DOMrect.setAttribute("x",this.posxy[0]);
    //this.DOMrect.setAttribute("y",this.posxy[1]);
    this.DOMrect.setAttribute("rx",7);
    this.DOMrect.setAttribute("ry",7);
    this.DOMrect.setAttribute("width",this.width);
    this.DOMrect.setAttribute("height",this.height);
    this.setReadOnly(this.readonly);
    this.DOMGroup.addEventListener("contextmenu",contextmenu);
    this.DOMGroup.addEventListener("mousedown",down);
    this.DOMGroup.addEventListener("touchstart",down);
    this.DOMGroup.addEventListener("mousemove",move);
    this.DOMGroup.addEventListener("touchmove",touchmove);
    this.DOMGroup.addEventListener("mouseup",up);
    this.DOMGroup.setAttribute("class","flow_tablegroup") ; 
    this.DOMGroup.setAttribute("transform","translate("+this.posxy[0]+","+this.posxy[1]+")");
    this.DOMtitle = document.createElementNS("http://www.w3.org/2000/svg","text");      
    this.DOMtitle.setAttribute("transform","translate(30,"+fieldRowHeight+")");
    this.DOMtitle.table=this; 
    this.DOMtitle.setAttribute("class","flow_tables") ; 
    this.DOMtitle.addEventListener("mousedown",titleClick);

    this.DOMContextmenu = document.createElementNS("http://www.w3.org/2000/svg","text");      
    this.DOMContextmenu.setAttribute("transform","translate(5,"+fieldRowHeight+")");
    this.DOMContextmenu.table=this; 
    this.DOMContextmenu.setAttribute("class","flow_context") ; 
    this.DOMContextmenu.addEventListener("mousedown",contextmenu);
    this.DOMContextmenu.innerHTML="&#xf040;";

    this.DOMFieldsGroup=document.createElementNS("http://www.w3.org/2000/svg","g");       
    this.DOMFieldsGroup.setAttribute("transform","translate(3,32)"); 
    
    this.DOMGroup.appendChild(this.DOMrect);
    this.DOMGroup.appendChild(this.DOMtitle);
    this.DOMGroup.appendChild(this.DOMFieldsGroup);
    this.DOMGroup.appendChild(this.DOMContextmenu);
    
    this.refreshDOM();
    return this.DOMGroup;
  };
  this.refreshDOM=function(){
    this.setName(this.name);
    this.DOMrect.setAttribute("width",this.width);
    this.DOMrect.setAttribute("height",this.height);
    this.DOMGroup.setAttribute("transform","translate("+this.posxy[0]+","+this.posxy[1]+")");
    this.refreshFields();
  };

  this.refreshFields=function(){
    var el=this.DOMFieldsGroup;    
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
    var a = this.AFields;
    const fleft=[5,this.width*0.4,this.width*0.8];
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      
      var fi = document.createElementNS("http://www.w3.org/2000/svg","text");       
      fi.setAttribute("transform","translate("+fleft[0]+","+((i*fieldRowHeight)+fieldRowPadding)+")");
      fi.addEventListener("mousedown",fieldClick);
      fi.setAttribute("class","flow_fields")  ;
      var fi2 = document.createElementNS("http://www.w3.org/2000/svg","text");       
      fi2.setAttribute("transform","translate("+fleft[1]+","+((i*fieldRowHeight)+fieldRowPadding)+")");      
      fi2.setAttribute("class","flow_fields_noevent")  ;
      var fi3 = document.createElementNS("http://www.w3.org/2000/svg","text");       
      fi3.setAttribute("transform","translate("+fleft[2]+","+((i*fieldRowHeight)+fieldRowPadding)+")");      
      fi3.setAttribute("class","flow_fields_noevent")  ;
      fi.fi2=fi2;
      fi.fi3=fi3;  
      
      var fib = document.createElementNS("http://www.w3.org/2000/svg","rect");       
      fib.setAttribute("x", 0);
      fib.setAttribute("y", (((i-1)*fieldRowHeight)+fieldRowPadding));
      fib.setAttribute("width", this.width-6);
      fib.setAttribute("height", fieldRowHeight);  
          
      if (i%2==0)
        fib.setAttribute("class","flow_fields_color3");
      else
        fib.setAttribute("class","flow_fields_color4");      
      fi.field=e;
      e.DOMElement=fi;
      e.posrow=i;
      fi.innerHTML=e.name;
      fi2.innerHTML=AType.SearchTypeById(e.type).name;
      fi3.innerHTML=e.length;
      
      el.appendChild(fib);    
      el.appendChild(fi); 
      el.appendChild(fi2); 
      el.appendChild(fi3); 
    }
    this.refreshConstraints();
  };

  this.refreshConstraints=function(){
    var a = this.AFields;
    var tmptables=[];
    for (let i = 0; i < a.length; i++) {
      const e = a[i];      
      var t=e.refreshLink();
      if (t!=null){
        tmptables.push(t);
      }
    }
    //reverse refresh
    for (let i = 0; i < ATables.length; i++) {
      const t = ATables[i];
      var chk = (tmptables.indexOf(t)>-1);

      if (t!=this && chk!=true){
        for (let j = 0; j < t.AFields.length; j++) {
          const f = t.AFields[j];
          if (f.link!=null){
            if (f.link.table==this){
              f.refreshLink();
              //f.table.refreshConstraints();
            }
          }
        }      
      }
    }
  };

  this.refreshRecordFields=function(){ //if the fields are change
    if (this.Records.length<2) return;
    var table = this;
    table.AFields.forEach(function(o,i){
      table.Records[0][i]=o.name;
    });
  };

  this.recalcAutoincFields=function(){
    var table = this;
    table.AFields.forEach(function(o,i){
      if (o.type==3){
        // refresh autoinc fields
        o.autoinc=AUTOINCTSTART;
        for (let j = 1; j < table.Records.length; j++) {
          const r = table.Records[j];
          try {
            if (Number(r[i])>=o.autoinc) 
              o.autoinc=Number(r[i])+1;            
          } catch (error) {            
          }
        }
      }
    });   
  };

  this.Selected=function(){
    if (SelectedTable!=null) {
      SelectedTable.noSelected();  //table  
    }
    SelectedTable=this;
    SelectedField=null;
    this.setReadOnly(this.readonly);
    //this.DOMrect.setAttribute("style",selectedStyle);
    refreshFieldsListDOM();
  };
  this.noSelected=function(){
    SelectedTable=null;
    SelectedField=null;
    this.setReadOnly(this.readonly);
    //this.DOMrect.setAttribute("style",noSelectedStyle);
    refreshFieldsListDOM();
  };

  this.edit=function(parent){
    if (stateEdit) return;
    stateEdit=true;
    var div = document.createElement("div");
    div.className="flow_edit";
    div.style.top=Number(this.posxy[1]+20)+"px";
    div.style.left=Number(this.posxy[0]-30)+"px";
    div.innerHTML=
    `<label>Tablename</label><input type="text" id="edit_name" value="`+this.name+`"><br>
     <label>Width</label><input type="number" id="edit_width" step="30" value="`+this.width+`"><br>
     <label>Height</label><input type="number" id="edit_height" step="30" value="`+this.height+`"><br>
     <label>Color</label><input type="color" id="edit_color" value="`+this.color+`"><br>
     <label>Description</label><textarea id="edit_description" cols="40" rows="5">`+nullstring(this.description)+`</textarea>
     `;
     
    div.innerHTML+=`<label>Readonly mean will no export to SQL file</label>`;
    if (this.readonly)
      div.innerHTML+=`<input type="checkbox" id="edit_readonly" checked >`;
    else  
      div.innerHTML+=`<input type="checkbox" id="edit_readonly" >`;
    div.innerHTML+=`<br>
     <button onclick="editTableOK(this)">OK</button>
     <button onclick="editTableCancel(this)">Cancel</button>
     <button onclick="editTableDelete(this)">Delete</button>
    `;
    div.table=this;
    parent.appendChild(div);
    return div;
  };

  this.browse=function (parent) {
    if (stateEdit) return;
    stateEdit=true;
    var div = document.createElement("div");  //create ID=LIST DIV before AREA
    div.className="flow_browse";
    div.setAttribute("id","list");
    parent.appendChild(div);
    this.Selected();
    list( ATables.indexOf(this),"list");

    div.table=this;
    
    return div;
  };


  this.destroy = function(){
    var linksto=this.getLinksTo();
    var linksfrom=this.getLinksFrom();
    linksto.forEach(function(fields,i){
      fields.deleteLink();      
    });
    linksfrom.forEach(function(fields,i){
      fields.deleteLink();      
    });

    this.AFields=[];
    this.Records=[];
    if (this !=null && this.DOMGroup!=null)
      flowdbeditor.removeChild(this.DOMGroup); 

    /*for (let i = 0; i < AFields.length; i++) {
      const f = AFields[i];
      f.Clear();
    }*/
  };

  this.getXML = function(xml,root){
    var t = xml.createElement("table");root.appendChild(t);    
    t.setAttribute("name",this.name);
    t.setAttribute("posxy",this.posxy);
    t.setAttribute("width",this.width);
    t.setAttribute("height",this.height);
    t.setAttribute("readonly",this.readonly);
    t.setAttribute("visible",this.visible);
    t.setAttribute("color",this.color);
    t.setAttribute("description",this.description);
    for (let i = 0; i < this.AFields.length; i++) {
      const f = this.AFields[i];
      f.getXML(xml,t);
    }
    var rec = xml.createElement("records");t.appendChild(rec);
    this.Records.forEach(function(item,index){
      var row = xml.createElement("row");rec.appendChild(row);
      item.forEach(function(cols,idx){
        var col = xml.createElement("col");row.appendChild(col);
        try {
          //col.innerText=cols;
          //col.innerHTML=encodeStr(col.innerText);  
          col.innerHTML=encodeStr(cols);  
        } catch (error) {
          console.log(error);          
        }        
      });
    });
  };
  this.setFromXML = function(node){
    this.name=node.getAttribute("name");
    this.posxy=node.getAttribute("posxy").split(",");
    for (let i = 0; i < this.posxy.length; i++) {
      const p = Number(this.posxy[i]);
      this.posxy[i]=p;
    }
    this.width=Number(node.getAttribute("width"));
    this.height=Number(node.getAttribute("height"));
    this.setReadOnly(node.getAttribute("readonly")=="true");  
    this.setVisible(node.getAttribute("visible")=="true");  
    this.setDescription(nullstring(node.getAttribute("description")));
    this.setColor(nullstring(node.getAttribute("color"),"#888888"));
    var xmlfields = node.getElementsByTagName("field");
    for (let i = 0; i < xmlfields.length; i++) {
      const xmlfield = xmlfields[i];
      var f = new TField(this,"fieldx");      
      f.setFromXML(xmlfield);
      this.AFields.push(f);
    }

    var rec = node.getElementsByTagName("records");
    if (rec!=null) 
      rec = rec[0];
    
    var row = rec.getElementsByTagName("row");
    this.Records=[];
    var Rec=this.Records;
    Array.prototype.forEach.call(row,function(r,ridx){
      var col = r.getElementsByTagName("col");
      var bc=[];
      Array.prototype.forEach.call(col,function(c,cidx){
        //cols
        bc.push(decodeStr(c.innerHTML));
      });
      Rec.push(bc);
    });
    
    

  };
  this.setLinksFromTemp = function(){    
    for (let i = 0; i < this.AFields.length; i++) {
      const f = this.AFields[i];      
      f.setLinksFromTemp();
    }
  };
  //don't use!! USE like AFields.SearchFieldByName...
  this.SearchFieldByName=function(fieldname){
    const result = this.find( fi => fi.name === fieldname );
    return result;
  };
  this.getLinksTo=function(){ //result fields[]
    var res=[];
    if (this.AFields!=null){
      this.AFields.forEach(function(field,index){
        if (field!=null && field.link!=null){
          res.push(field);
        }
      });
    }
    return res;
  };
  this.getLinksFrom=function(){ //result fields[]
    var res=[];
    const Table=this;
    if (ATables!=null){
      ATables.forEach(function(table,index){
        if (table!=null && table.AFields!=null){
          table.AFields.forEach(function(field,index2){
            if (field!=null && field.link!=null){
              if (field.link.table==Table)
                res.push(field);
            }
          });
        }
      });
    }
    return res;
  };

  this.changeFieldType=function(oldtyp,newtyp,fieldidx){
    if (oldtyp==newtyp) return;
    var per=(60000*60*24);
    //various
    if (oldtyp ==0 ) {//from string
      switch (newtyp) {
        case 1:
        case 2:
        case 3:   //numeric        
          this.Records.forEach(function(o,i){
            if(i>0)
              o[fieldidx]=Number(o[fieldidx]);              
          });            
          break;
        case 7: //bool
          this.Records.forEach(function(o,i){
            if(i>0)
              if ((o[fieldidx]!='0') && (o[fieldidx]!='1')){
                if ((o[fieldidx]==null) || (o[fieldidx]=="")){
                  o[fieldidx]='0';
                } else {
                  o[fieldidx]='1';    
                }
              }              
          });     
          break;
        default:
          break;
      }
    }
    if (oldtyp==2) //from float 
    {
      switch (newtyp) {
        case 1:
        case 3:
          this.Records.forEach(function(o,i){
            if(i>0)
              o[fieldidx]=Math.round(Number(o[fieldidx]));
          });
          break;
        case 7:
          this.Records.forEach(function(o,i){
            if(i>0)
              o[fieldidx]=Math.round(Number(o[fieldidx]));
              if (o[fieldidx]>1) 
                o[fieldidx]=1;
              else if (o[fieldidx]<0)
                o[fieldidx]=0;
          });
          break;    
        case 4: //date
          this.Records.forEach(function(o,i){
            if(i>0) {
              try {
                var mydate = new Date(Number(o[fieldidx])*per);
                o[fieldidx]=mydate.toDateString();                  
              } catch (error) {
                o[fieldidx]=(new Date(0)).toDateString();
              }
            }
          });  
          break;    
        case 5: //datetime
          this.Records.forEach(function(o,i){
            if(i>0) {
              try {
                var mydate = new Date(Number(o[fieldidx])*per);
                o[fieldidx]=mydate.toLocaleString('en-GB', { timeZone: 'UTC' }); //toISOString();                  
              } catch (error) {
                o[fieldidx]=(new Date(0)).toLocaleString('en-GB', { timeZone: 'UTC' }); //toISOString();                  
              }
            }
          });
          break;    
        case 6: //time
          this.Records.forEach(function(o,i){
            if(i>0) {
              try {
                var d = Number(o[fieldidx])-Math.floor(Number(o[fieldidx]));
                var mydate = new Date(  d  );
                o[fieldidx]=mydate.toLocaleTimeString('en-GB');                  
              } catch (error) {
                o[fieldidx]=(new Date(0)).toLocaleTimeString('en-GB');
              }
            }
          });
          break;    
        default:
          break;
      }
    }
    if (oldtyp==4){ //from Date
      switch (newtyp) {
        case 1:
        case 2:   //days from 1970
        case 3:        
          
          this.Records.forEach(function(o,i){
            if(i>0){
              try {
                var mydate = new Date(o[fieldidx]);
                o[fieldidx]=Math.floor(mydate.getTime()/per);                                
              } catch (error) {
                o[fieldidx]=0;
              }
            }
          }); 
          break;
      
        default:
          break;
      }
    }
  };

  this.AFields.SearchFieldByName=this.SearchFieldByName;
};
var idField = 0;

var TField = function(table,name){
  
  this.type=0;  //TType
  this.length=45;
  this.link=null; //null or TField constraint
  this.linkfilter=[false,null,null,null]; //TODOif link attached: enabled, from, to: false,null,null;   true,1,5,idgroup;    true,4,4,idgroup
  this.table=table; //TTable parent
  this.posrow=0;   //row 0,1,2,3...  
  this.DOMElement=null;  //to svg text
  this.DOMLink=null;  //Line to another field
  this.name=name;
  this.autoinc=AUTOINCTSTART;
  this.display=false; //if true then if the table is linked then this field is display 
  this.description="";//TODO

  this.setDescription=function(value){    
    this.description=nullstring(value);
  };
  this.setName=function(name){
    name=name.trim().replace(" ","_");
    if (name==""){
      name="Field"+(idField++);
    }
    this.name=name;
    if (this.table!=null){
      this.table.refreshRecordFields();
      this.table.refreshFields();
    }
    refreshFieldsListDOM();    
  };
  this.edit=function(parent){
    if (stateEdit) return;
    stateEdit=true;
    var div = document.createElement("div");
    div.className="flow_edit";    
    div.style.top=Number(this.table.posxy[1]+20)+"px";
    div.style.left=Number(this.table.posxy[0]-30)+"px";
    div.innerHTML=`<label>Fieldname</label><input type="text" id="edit_name" value="`+this.name+`"><br>`;
    var opt = `<label>Fieldtype</label><select id="edit_type">`;
    for (let i = 0; i < AType.length; i++) {
      const at = AType[i];
      if (this.type==at.id){
        opt+=`<option selected value="`+at.id+`">`+at.name+`</option>`;  
      }else {
        opt+=`<option value="`+at.id+`">`+at.name+`</option>`;  
      }
    }     
    div.innerHTML+=opt+`</select><br>
     <label>Length</label>
     <input type="number" id="edit_length" value="`+this.length+`">
     <label>Display this field when table is linked:</label>`;
     if (this.display) {
      div.innerHTML+=`<input type="checkbox" id="edit_display" checked>`;
     }else {
      div.innerHTML+=`<input type="checkbox" id="edit_display">`;
     }
     div.innerHTML+=`<hr>
     <label>Description</label><textarea id="edit_description" cols="40" rows="5">`+nullstring(this.description)+`</textarea><hr>
     <button onclick="editFieldDelete(this)">Delete Field</button>
     <hr><label>Data from another table:</label>
     <button onclick="editFieldLink(this)">LinkTo</button>
     <button onclick="editFieldLinkDelete(this)">DeleteLink</button>`;
     if (this.link!=null){
        div.innerHTML+=`<label>Link filtered values range:</label>`;
        if (this.linkfilter[0]) {
          div.innerHTML+=`<input type="checkbox" linked="DOMfilterDIV" onchange="changeCHKfilter(this)" id="edit_linkfilter" checked>`;
        }else {
          div.innerHTML+=`<input type="checkbox" linked="DOMfilterDIV" onchange="changeCHKfilter(this)" id="edit_linkfilter">`;
        }
        div.innerHTML+=`<br><span id="DOMfilterDIV"><input type="number" id="edit_linkfilter1" value="`+this.linkfilter[1]+`">
        <input type="number" id="edit_linkfilter2" value="`+this.linkfilter[2]+`">
        <label>Filter by</label><input type="text" id="edit_linkfilterfield" value="`+this.linkfilter[3]+`">
        </span>`;        
     }
     div.innerHTML+=`<hr><button onclick="editFieldOK(this)">OK</button>
     <button onclick="editFieldCancel(this)">Cancel</button>`;
    div.field=this;
    parent.appendChild(div);
    if (this.link!=null) {
      changeCHKfilter(document.getElementById("edit_linkfilter"));
    }
    return div;
  };
  this.setType=function(value) {
    this.type=value;
    if (value!=0){
      this.length=0;
    }
  };

  this.addLink=function(field){
    this.link = field;    
    this.DOMLink =document.createElementNS("http://www.w3.org/2000/svg","line");
    this.DOMLink.setAttribute("x1",100);
    this.DOMLink.setAttribute("y1",100);
    this.DOMLink.setAttribute("x2",300);
    this.DOMLink.setAttribute("y2",200);
    //this.DOMLink.setAttribute("class","flow_line");

    var k =document.createElementNS("http://www.w3.org/2000/svg","line");
    k.setAttribute("x1",100);
    k.setAttribute("y1",100);
    k.setAttribute("x2",300);
    k.setAttribute("y2",200);
    //k.setAttribute("class","flow_line_start");
    this.DOMLink.k=k;
    var v =document.createElementNS("http://www.w3.org/2000/svg","line");
    v.setAttribute("x1",100);
    v.setAttribute("y1",100);
    v.setAttribute("x2",300);
    v.setAttribute("y2",200);
    //v.setAttribute("class","flow_line_end");
    this.DOMLink.v=v;
    flowdbeditor.appendChild(this.DOMLink.v);
    flowdbeditor.appendChild(this.DOMLink.k);
    flowdbeditor.appendChild(this.DOMLink);
    
  
    this.refreshLink();
  };
  this.deleteLink=function(){
    if(this.link!=null){
      if (this.DOMLink!=null){
        if (this.DOMLink.v!=null)
          flowdbeditor.removeChild(this.DOMLink.v);
        if (this.DOMLink.k!=null)          
          flowdbeditor.removeChild(this.DOMLink.k);
        flowdbeditor.removeChild(this.DOMLink);
        this.DOMLink=null;
        this.link=null;
      }
    }
  }; 
  this.refreshLink=function(){
    if (this.DOMLink!=null){
      if (this.link!=null){
        if ((!this.table.visible) || (!this.link.table.visible)){
          //TODO each table is invisible
          this.DOMLink.setAttribute("class","flow_line_hidden");
          this.DOMLink.k.setAttribute("class","flow_line_start_hidden");
          this.DOMLink.v.setAttribute("class","flow_line_end_hidden");
        }else {
          this.DOMLink.setAttribute("class","flow_line");
          this.DOMLink.k.setAttribute("class","flow_line_start");
          this.DOMLink.v.setAttribute("class","flow_line_end");
        }
        var a=this.getPosXY();
        var b=this.link.getPosXY();
        this.DOMLink.setAttribute("x1",a[0]-16);
        this.DOMLink.setAttribute("y1",a[1]);
        this.DOMLink.setAttribute("x2",b[0]+this.link.table.width);
        this.DOMLink.setAttribute("y2",b[1]);

        this.DOMLink.k.setAttribute("x1",a[0]-16);
        this.DOMLink.k.setAttribute("y1",a[1]);
        this.DOMLink.k.setAttribute("x2",a[0]);
        this.DOMLink.k.setAttribute("y2",a[1]);

        this.DOMLink.v.setAttribute("x1",b[0]+this.link.table.width);
        this.DOMLink.v.setAttribute("y1",b[1]-8);
        this.DOMLink.v.setAttribute("x2",b[0]+this.link.table.width);
        this.DOMLink.v.setAttribute("y2",b[1]+8);
        
        return this.link.table;
      }
    }
  };
  this.getPosXY=function(){  
    //var t = this.table.DOMGroup.getAttribute("transform"); //Late!
    //var o1 = tool_getTransform(t);
    var o1=[0,0];
    o1[0]=this.table.posxy[0];
    o1[1]=this.table.posxy[1];
    o1[1]+=(this.posrow*fieldRowHeight)+fieldRowPadding+fieldRowHeight+(fieldRowHeight/2);//title is
    return [o1[0],o1[1]];
    //Table  
    //return [this.table.posxy[0],this.table.posxy[1]];
  };
  this.getXML = function(xml,root){
    var f = xml.createElement("field");root.appendChild(f);    
    f.setAttribute("name",this.name);
    f.setAttribute("type",this.type);
    f.setAttribute("length",this.length);
    f.setAttribute("description",this.description);
    if (this.linkfilter[0])
      f.setAttribute("linkfilter",1);
    else
      f.setAttribute("linkfilter",0);    
    f.setAttribute("linkfiltermin",this.linkfilter[1]);
    f.setAttribute("linkfiltermax",this.linkfilter[2]);
    f.setAttribute("linkfilterfield",this.linkfilter[3]);
    if (this.display)
      f.setAttribute("display",1);
    else
    f.setAttribute("display",0);
    if (this.link!=null){
      f.setAttribute("link",[this.link.table.name,this.link.name]);
    }    
    f.setAttribute("autoinc",[this.autoinc]);
  };
  this.setFromXML = function(node){
    this.name=node.getAttribute("name");
    this.type=Number(node.getAttribute("type"));
    this.length=Number(node.getAttribute("length")); 
    this.linktext = node.getAttribute("link");
    this.display = node.getAttribute("display");
    var linkfilt = node.getAttribute("linkfilter");
    this.setDescription(nullstring(node.getAttribute("description")));
    if (this.display=='0') 
      this.display = false;
    else
      this.display = true;
    if (linkfilt=='0') 
      this.linkfilter[0] = false;
    else
      this.linkfilter[0] = true;
    this.linkfilter[1] = node.getAttribute("linkfiltermin");
    this.linkfilter[2] = node.getAttribute("linkfiltermax");
    this.linkfilter[3] = nullstring(node.getAttribute("linkfilterfield"));
      
    this.autoinc = node.getAttribute("autoinc");
    if (this.linktext!=null){
      this.linktext=this.linktext.split(",");
    }
  };
  this.setLinksFromTemp = function(){
    if (this.linktext!=null){
      var tablename=this.linktext[0];
      var fieldname=this.linktext[1];
      
      var t = ATables.SearchTableByName(tablename);
      var f = t.AFields.SearchFieldByName(fieldname);
      //this.link=f;
      this.addLink(f);
    }    
  };
  this.destroy = function(){
    var index = this.table.AFields.indexOf(this);
    if (index>-1){
      if (this.link!=null){
        this.deleteLink();
      }
      var linksfrom = this.table.getLinksFrom();
      linksfrom.forEach(function(fields,i){
        if (fields==this)
          fields.deleteLink();      
      });
      this.table.AFields.splice(index, 1);
      this.table.Records.forEach(function(o,i){
        o.splice(index, 1);
      });

      this.table.refreshFields();
      refreshFieldsListDOM();

    }
  };

  this.toString=function(){
    return this.name+" "+AType.SearchTypeById(this.type).name+" "+this.length;
  };
};

//#region Arrays, Types -----------------------------

var idTtype=0;
var TType = function(name,sql,inputtype,mssql){
  this.id=idTtype++;
  this.name=name;
  this.sql=sql;
  this.inputtype=inputtype;
  this.mssql = mssql;
};

var OpenEye = Object.freeze({"Open":"&#xf06e;&nbsp;","Close":"&#xf070;&nbsp;"});
var FlowModes = Object.freeze({"Flow":1, "Constraint":2});
//AType struct: displaytext,mysqltype,htmltype,| mssqltype,,,,
//                     0        1         2         3  
var AType = [new TType("String","varchar(%)","text","[nvarchar(%)]"),
       new TType("Integer","int(11)","number","[int]"),
       new TType("Float","Float","number","[float]"),
       new TType("Autoinc","int(11) not null","number","[int]"),
       new TType("Date","date","date","[date]"),
       new TType("DateTime","datetime","datetime-local","[datetime2]"),
       new TType("Time","time","time","[time]"),
       new TType("Bool","tinyint","checkbox","[tinyint]"),
       new TType("Text","text","text","[nvarchar(max)]"),
       new TType("Image","mediumblob",'<img src="%0">',"[image]"),
       new TType("URL","varchar(400)",'<a href="%0">%1</a>',"[nvarchar(400)]"),
       new TType("VideoLink","varchar(400)",'<a href="%0">%1</a>',"[nvarchar(400)]")];
var SearchTypeById = function(id){
  const result = AType.find( tab => tab.id === id );
  return result;
};
AType.SearchTypeById=SearchTypeById;

var SelectedTable = null;
var flowMode = FlowModes.Flow;
var SelectedField = null;//SPRcog only TODO
var constraintField =null; //starting field

var ATables = [];
var SearchTableByName = function(tablename){
  tablename=tablename.toLowerCase();
  const result = ATables.find( tab => tab.name.toLowerCase() === tablename );
  return result;
};
var ATablesclear=function(){
  for (let i = 0; i < ATables.length; i++) {
    const t = ATables[i];
    if (t!=null)
      t.destroy();
  }
  ATables = [];ATables.clear=ATablesclear; 
  ATables.SearchTableByName=SearchTableByName;
};
ATables.clear=ATablesclear;
ATables.SearchTableByName=SearchTableByName;

//#endregion Arrays

//#region HIGH

function sortTables(){
  oncehints.hint("outside");
  if (ATables!=null){
    ATables.forEach(function(table,idx){
      var ok=true;
      if (table.posxy[0]<0) {table.posxy[0]=100;ok=false;}
      if (table.posxy[1]<0) {table.posxy[1]=100;ok=false;}
      if (!ok){
        table.refreshDOM();
      }
    });    
    Save(temp);
  }
}

function newTable(){
  var t = new TTable("Unknown");
  t.addField("id",3); //autoinc
  ATables.push(t);
  flowdbeditor.appendChild(t.getDOM());
  refreshTablesListDOM();
  return t;
}

function refreshTablesListDOM(){
  var l=document.getElementById("tables");
  l.innerHTML="";
  for (let i = 0; i < ATables.length; i++) {
    const e = ATables[i];
    var obj = document.createElement("div");
    if (i%2==0)
      obj.className="flow_tables flow_tables_color1";
    else
      obj.className="flow_tables flow_tables_color2";
    
    var bt =  document.createElement("span");
    bt.table= e;
    bt.className="flow_context";
    bt.setAttribute("onclick","hidetable(this)");
    if (e.visible){
      bt.innerHTML=OpenEye.Open;
      bt.className="flow_context";
    }
    else{
      bt.innerHTML=OpenEye.Close;
      bt.className="flow_context red";
    }
    bt.style.width="40px;";
    obj.appendChild(bt);
    txt = document.createElement("span");
    txt.innerHTML=e.name;
    obj.appendChild(txt);
    //obj.innerHTML=`<button class='flow_context' onclick="hidetable(this)">&#xf06e;&nbsp;</i><span>`+e.name+`</span>`;
    l.appendChild(obj);
  }
}

function hidetable(button){
  button.table.setVisible(!button.table.visible);
  if (button.table.visible) {
    button.innerHTML=OpenEye.Open;
    button.className="flow_context";
  } else {
    button.innerHTML=OpenEye.Close;
    button.className="flow_context red";
  }
}

function newField(){
  if (SelectedTable!=null){
    SelectedTable.addField("Field"+(idField++),0);
    SelectedTable.refreshFields();
    refreshFieldsListDOM();
  } else {
    alert("Please select a table!");
  }
}

//with contsraints
function refreshFieldsListDOM(){  
  var l=document.getElementById("fields");
  l.innerHTML="";
  var co=document.getElementById("constraints");
  co.innerHTML="";
  if (SelectedTable==null) return;
  var coindex=0;

  for (let i = 0; i < SelectedTable.AFields.length; i++) {
    const e = SelectedTable.AFields[i];

    var obj = document.createElement("div");
    if (i%2==0)
      obj.className="flow_fields flow_fields_color1";
    else
      obj.className="flow_fields flow_fields_color2";

    obj.innerHTML=e.name;
    l.appendChild(obj);
    if (e.link!=null){
      var f2=e.link;      
      obj = document.createElement("div");
      if (coindex++%2==0)
        obj.className="flow_constraints flow_constraints_color1";
      else
        obj.className="flow_constraints flow_constraints_color2";
      obj.innerHTML=f2.table.name+"."+f2.name+"->"+e.name;
      co.appendChild(obj);
    }
  }
}

var automodeLink=true;
function newConstraint(b,nohint){  
  if (b!=null){
    if (flowMode==FlowModes.Flow){
      flowMode=FlowModes.Constraint;
      b.innerHTML="Stop link";
      b.className="s100 flow_constraintmode";
      flowdbeditor.style="background-color: #ccccff;";
      if (nohint == null){
        oncehints.hint("NewLink");
      }
    }else {
      if (flowMode==FlowModes.Constraint){
        automodeLink=true;
        flowMode=FlowModes.Flow;
        b.innerHTML="Start link";
        b.className="s100 flow_flowmode";
        flowdbeditor.style="background-color: white;";
      }
    }
  }
}


function titleClick(e){
  this.table.edit(document.getElementById("area"));
}

function fieldClick(e){
  if (flowMode==FlowModes.Flow){
    SelectedField=this.field;
    this.field.edit(document.getElementById("area"));
  }
  if (flowMode==FlowModes.Constraint){
    if (constraintField==null){ //startpoint
      constraintField  = this.field;
    } else { //endpoint
      constraintField.deleteLink();      
      constraintField.addLink(this.field);      
      constraintField  = null;
      if (automodeLink==false){
        var b= document.getElementById("newconstraint");
        newConstraint(b,true); 
      }
    }
  }
}


//TABLE FIELD PANEL REMOVE
function removePanelDOM(div){
  div.parentElement.parentElement.removeChild(div.parentElement);
  stateEdit=false;  
}
//region TABLE Buttons
function editTableOK(div){
  var panel = div.parentElement;
  var ename = document.getElementById('edit_name');
  var ewidth = document.getElementById('edit_width');
  var eheight = document.getElementById('edit_height');
  var ereadonly = document.getElementById('edit_readonly');
  var edescription = document.getElementById('edit_description');
  var ecolor = document.getElementById('edit_color');
  panel.table.setName(ename.value);
  panel.table.width=Number(ewidth.value);
  panel.table.height=Number(eheight.value);
  panel.table.setReadOnly(ereadonly.checked);
  panel.table.setColor(ecolor.value);
  panel.table.setDescription(edescription.value);

  removePanelDOM(div);
  panel.table.refreshDOM();
  refreshTablesListDOM();  
  Save(temp);
}
function editTableCancel(div){
  removePanelDOM(div);
    
}
function editTableDelete(div){
  if (confirm("DELETE TABLE with all fields! Sure?")) {
    var panel = div.parentElement;
    var index = ATables.indexOf(panel.table);
    if (index > -1) {
      ATables.splice(index, 1);
      panel.table.destroy();
      refreshTablesListDOM();
      removePanelDOM(div);
      Save(temp);
    }
  }  
}
//endregion

function PastePanel(e){
  if (stateEdit) return;
  e.preventDefault();
  var content="";
  if( (e.originalEvent || e).clipboardData ){
    content = (e.originalEvent || e).clipboardData.getData('text/plain');
  }
  else if( window.clipboardData ){
    content = window.clipboardData.getData('Text');    
  }
  if ((content!="") && (content!=null)){
    var div=document.createElement("div");
    div.className="flow_clipboard";
    document.body.appendChild(div);
    div.clipboard=content;
    div.innerHTML=`<input id="pasteheader" type="checkbox">The clipboard data has header in first row<br>`;
    div.innerHTML+=`<input id="pastenewtable" type="checkbox" >Create new table instead of fill selected table<br>`;
    div.innerHTML+=`<button onclick="onPaste(this.parentElement,null)">Rendben</button><button onclick="this.parentElement.parentElement.removeChild(this.parentElement)">Mégsem</button>`;
  }
}

function onPaste(div,startidx){        
    var content = div.clipboard;
    
    if (startidx==null){
      var idx=document.getElementById("pasteheader");
      if (idx.checked)
        startidx = 1
      else 
        startidx = 0;
    }

    var newtable = document.getElementById("pastenewtable");
    if (newtable.checked) {
      
      var t = new TTable("Unknown");      
      ATables.push(t);
      flowdbeditor.appendChild(t.getDOM());      
      t.Selected();
    }
    
    if (content!=""){
      console.log( typeof content );
      if (SelectedTable){      
        const cvs = content.split("\n");
        for (let i = startidx; i < cvs.length; i++) {
          cvs[i]=cvs[i].replace("\r","");        
          const row = cvs[i].split("\t");

          if (newtable.checked) {
            if (i==startidx){ //first data and if new table then create AFields
              for (let k = 0; k < row.length; k++) {
                SelectedTable.addField("Field"+(idField++),0);
              }
            }
            if (idx.checked){ //has header 
              if (i==1){ //first data
                cvs[0]=cvs[0].replace("\r","");        
                const hrow = cvs[0].split("\t");
                for (let k = 0; k < hrow.length; k++) {
                  SelectedTable.AFields[k].name=hrow[k];
                }                  
              }
            }
          }

          list_addrecordheader(SelectedTable);                                
          SelectedTable.Records.push(row);        
        }
        SelectedTable.refreshFields();
        SelectedTable.recalcAutoincFields();
        refreshTablesListDOM();
      }
      //document.execCommand('insertText', false, content);      
    }

    div.parentElement.removeChild(div);
}

//region FIELD Buttons
function editFieldOK(div){
  var panel = div.parentElement;
  var ename = document.getElementById('edit_name');
  var etype = document.getElementById('edit_type');
  var elength = document.getElementById('edit_length');
  var edisplay = document.getElementById('edit_display');
  var edescription = document.getElementById('edit_description');
  
  var elinkfilter = document.getElementById('edit_linkfilter');
  var elinkfilter1 = document.getElementById('edit_linkfilter1');
  var elinkfilter2 = document.getElementById('edit_linkfilter2');  
  var elinkfilterfield = document.getElementById('edit_linkfilterfield');  
  if (elinkfilter!=null){
    try {
      panel.field.linkfilter[0]=elinkfilter.checked;
      panel.field.linkfilter[1]=elinkfilter1.value;
      panel.field.linkfilter[2]=elinkfilter2.value;        
      panel.field.linkfilter[3]=elinkfilterfield.value;
    } catch (error) {
      
    }
  }
  panel.field.name = ename.value;
  //change type than records
  if (panel.field.type!=Number(etype.value)){
    panel.field.table.changeFieldType(panel.field.type,Number(etype.value),panel.field.posrow);
    panel.field.type=Number(etype.value);
  }  
  panel.field.display = edisplay.checked;
  panel.field.length = Number(elength.value);
  panel.field.setDescription(edescription.value);
  removePanelDOM(div);
  panel.field.table.refreshRecordFields();
  panel.field.table.refreshFields();
  refreshFieldsListDOM();
  Save(temp);
}
function editFieldCancel(div){
  removePanelDOM(div);

}
function editFieldDelete(div){
  if (confirm("DELETE ONE FIELD! Sure?")) {    
    var panel = div.parentElement;
    panel.field.destroy();
    removePanelDOM(div);
    Save(temp);
  } 
}
function editFieldLink(div){
    automodeLink=false;
    var panel = div.parentElement;
    removePanelDOM(div);
    var b= document.getElementById("newconstraint");
    newConstraint(b,true);
    constraintField  = panel.field;  
    oncehints.hint("NewLinkFromPanel");
}
function editFieldLinkDelete(div){
  if (confirm("DELETE LINK! Sure?")) {    
    var panel = div.parentElement;
    panel.field.deleteLink();
    removePanelDOM(div);
  } 
}
function changeCHKfilter(chk){  
  var DOM = chk.getAttribute("linked");
  if (DOM==null) return;
  var DOMfilterDIV = document.getElementById(DOM);
  if ((chk.checked) && (DOMfilterDIV!=null)){
    DOMfilterDIV.style.visibility="visible";
    DOMfilterDIV.style.display="block";
  } else {
    DOMfilterDIV.style.visibility="hidden";
    DOMfilterDIV.style.display="none";
  }
}

//endregion


//#endregion HIGH

//#region START MOUSE AND TOUCH

var cX=-1;
var cY=-1;
var grab=0;

function down(e){
  //var t = this;
  var b = event.buttons;

  if (flowMode==FlowModes.Flow){
    if (b==1){
      /*
      var s = this.getAttribute("transform");
      var o =tool_getTransformPure(s);
      var topdistance = event.layerY-o[1];
      if (topdistance<20)
        contextmenu(e);
      */
      cX = event.clientX-grab;  
      cY = event.clientY-grab; 
      this.table.Selected();  //table
    } else {
      if (e.touches!=null){
        if (e.touches.length>0){
          cX = e.touches[0].clientX-grab;  
          cY = e.touches[0].clientY-grab; 
          this.table.Selected();  //table
        }
      }
    }

  } 
  if (flowMode==FlowModes.Constraint){
   
  }
}
//right mouse down
function contextmenu(e){
    e.preventDefault();
    e.currentTarget.table.browse(document.getElementById("area"));      
    //this.table.browse(document.getElementById("area"));      
}

var dX=0;
var dY=0;

function touchmove(e){
  if (flowMode==FlowModes.Flow){
    if(event.preventDefault) 
      event.preventDefault();
    if (e.touches!=null){
      if (e.touches.length>0){            
        var evtt = e.touches[0];
        this.parentElement.appendChild(this);
        dX = evtt.clientX -cX;  
        dY = evtt.clientY -cY;  
        cX = evtt.clientX-grab;  
        cY = evtt.clientY-grab;
        var s = this.getAttribute("transform");
        var o =tool_getTransform(s);
        s = "translate("+o[0]+","+o[1]+")";
        this.setAttribute("transform",s);
        this.table.setPosXY(o[0],o[1]);
        this.table.refreshConstraints();
      }
    }    
  }  
}
function move(e){
  var b = event.buttons;
  if (flowMode==FlowModes.Flow){
    if ((b & 1)==1){
      this.parentElement.appendChild(this);
      dX = event.clientX -cX;  
      dY = event.clientY -cY;  
      cX = event.clientX-grab;  
      cY = event.clientY-grab;
      var s = this.getAttribute("transform");
      var o =tool_getTransform(s);
      s = "translate("+o[0]+","+o[1]+")";
      this.setAttribute("transform",s);
      this.table.setPosXY(o[0],o[1]);
      this.table.refreshConstraints();
    }
  }  
}
function up(e){
  if (flowMode==FlowModes.Flow){
    //this.table.refreshConstraints();
    
  }
  Save(temp);
}

//#endregion  MOUSE MOVE TOUCH

//#region TOOLS

function getEditDistance2(p,cmd)  //(part,cmd) ->  [dist,chars,newcmd,%param value]
{ var res=[0,0,0,0];                    // nevezd át a táblát%nevűre > 
                                  // 1. nevezd át a táblát,nevezd át a táblát almafa névre
  var a=p.trim().split(" ");
  var b=cmd.split(" ");
  var c=b.splice(a.length);
  if (b.length<a.length){
    return null;
  }
  res[0]=getEditDistance(a.join(" "), b.join(" "));
  res[1]=p.length;
  res[3]=c.splice(0,1)[0];
  res[2]=c.join(" "); 
  return res; 
}

function getSimilarity(a,b){  
  var d=getEditDistance(a,b);
  return d/Math.max(a.length,b.length);
}

function getEditDistance(a, b){
  if(a.length == 0) return b.length; 
  if(b.length == 0) return a.length; 

  var matrix = [];

  // increment along the first column of each row
  var i;
  for(i = 0; i <= b.length; i++){
    matrix[i] = [i];
  }

  // increment each column in the first row
  var j;
  for(j = 0; j <= a.length; j++){
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for(i = 1; i <= b.length; i++){
    for(j = 1; j <= a.length; j++){
      if(b.charAt(i-1) == a.charAt(j-1)){
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                Math.min(matrix[i][j-1] + 1, // insertion
                                         matrix[i-1][j] + 1)); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
}
/*
function LoadFile(file,fuggveny){ //function(responsetxt) {
  $.get(file, fuggveny);
}*/
function LoadContentFromServer(file,fuggveny){
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function(){ 
      if (this.readyState==2){
          var mtimefile = this.getResponseHeader('Last-Modified')+file;
          var stimefile = localStorage.getItem("flowdbeditor_infileID");
          if ((stimefile!=null) && (stimefile==mtimefile))
            this.abort();
          else 
            localStorage.setItem("flowdbeditor_infileID",mtimefile);
      }     
      if (this.readyState==4){ // && xhttp.status==200){  
          fuggveny(this.responseText,this.status); //1. sora fejlec  2.adat        
      }
  };
  var s=file+"?id="+Math.random();
  xhttp.open("GET",s,true);            
  xhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
  xhttp.send();  
}

function URLExists(url)
{
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    try {
      http.send();
      return http.status!=404;        
    } catch (error) {
      return false;
    }    
}

var  hasModules=false;
function addModules(div){
  addModule("flowdbeff",div);
  addModule("flowdbplayer",div);  
}
function addModule(jsname,div){
  if (!URLExists(jsname+".js")) return false;
  loadModule(jsname,div);
}
function loadModule(jsname,div){
  var script = document.createElement('script');
  script.onload = function () {
      var b = document.createElement("button");
      b.setAttribute('onclick',jsname+"(this)");
      b.innerHTML=jsname;
      div.appendChild(b);
  };
  script.src = jsname+".js";
  document.head.appendChild(script); 
}

function nullstring(value,helyettes){
  if (value==null)
  {  if (helyettes==null)
      return "";
    else
      return helyettes;
  }
  else  
     return value;
}

function convertRemToPixels(rem) {    
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function tool_getTransform(s){
  s = s.substring(10,999);
  s= s.substring(0,s.length-1);
  s =s.split(",");
  return [Number(s[0])-grab+dX,Number(s[1])-grab+dY];  
}
function tool_getTransformPure(s){
  s = s.substring(10,999);
  s= s.substring(0,s.length-1);
  s =s.split(",");
  return [Number(s[0]),Number(s[1])];  
}

function encodeStr(rawStr){
  if ((typeof rawStr)=="string") {
    var encodedStr = rawStr.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
      return '&#'+i.charCodeAt(0)+';';
    });
    return encodedStr;
  } else {
    return rawStr;
  }
}

function decodeStr(str) {
    return str.replace(/&#(\d+);/g, function(match, dec) {
      return String.fromCharCode(dec);
    });
}
//#endregion TOOLS

//region --------LOAD / SAVE -------------------

function savetosvgfile(linknode,svgnode){  // print , flowdbeditor
  linknode=document.getElementById(linknode);
  var svg = document.getElementById(svgnode); //"svg"
  //get svg source.
  var serializer = new XMLSerializer();
  var source = serializer.serializeToString(svg);
  source=source.replace(/class="flow_fields_color3"/g,'style="fill:grey;stroke-width:0;opacity:0.5"');
  source = source.replace(/class="flow_fields_color4"/g,'style="fill:grey;stroke-width:0;opacity:0.3"');
  source = source.replace(/class="flow_line"/g,'style="stroke:black;stroke-width:2;"');
  source = source.replace(/class="flow_line_start"/g,'style="stroke:blue;stroke-width:4;"');
  source = source.replace(/class="flow_line_end"/g,'style="stroke:orange;stroke-width:2;"');
  //add name spaces.
  if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if(!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  //add xml declaration
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  //convert svg source to URI data scheme.
  //var url = "data:application/download;charset=utf-8,"+encodeURIComponent(source);
  var url = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(source);
  //set url value to a element's href attribute.
  linknode.href = url;
  //linknode.style.visibility="visible";
  linknode.setAttribute("download","flowdb.svg");
  linknode.innerHTML="RightClickforDownloadSVG";
  linknode.click();
  //you can download svg file by right click menu.
}

var xmlroot="flowdbeditor";
function Save(variable){
  oncehints.hint("save");
  var xmlText = SavetoString();
  if (variable!=null){
    //alert(variable);
    localStorage.setItem(variable,xmlText);
  } else {
    localStorage.setItem("flowdbeditor",xmlText);
  }
}
function Load(variable){
  var xmlText="";
  if (variable!=null){ 
    xmlText  = localStorage.getItem(variable);
  } else {
    xmlText  = localStorage.getItem("flowdbeditor");
  }
  oncehints.hint("load");
  LoadString(xmlText);
}
function SavetoString(){  
  var xml= document.implementation.createDocument(null, xmlroot);
  var root = xml.getElementsByTagName(xmlroot)[0];
  var setup = xml.createElement("setup");
  setup.setAttribute("idField",idField);
  setup.setAttribute("idTable",idTable);
  root.appendChild(setup);
  for (let i = 0; i < ATables.length; i++) {
    const table = ATables[i];
    table.getXML(xml,root);
  }
  return new XMLSerializer().serializeToString(xml);    
}

function LoadServerDefault(forceload){
  if (forceload){
    oncehints.hint("loadserverdefault");
    localStorage.setItem("flowdbeditor_infileID","");
  }  
  LoadContentFromServer(flowdbinit,function(txt,code){
    if (code==200){
      LoadString(txt);
      if (!forceload){
        var warning=document.getElementById("defaultcontent");
        warning.style.visibility="visible";
      }
    }
    else {   
      Load(temp);         
      //alert("Auto load from server file can't success!");
      // this is generally when date and filename same than last
    }
    var but=document.getElementById("flowdbload");
    but.activ=true;
  });

}

function LoadString(xmlText){
  ATables.clear();
  flowdbeditor=document.getElementById("flowdbeditor");
  flowdbeditor.innerHTML=`
      <defs>
          <linearGradient id="e" x1="40" y1="210" x2="460" y2="210" gradientUnits="objectBoundingBox">
              <stop stop-color="steelblue" offset="0" />
              <stop stop-color="red" offset="1" />
          </linearGradient>
      </defs>`; 
  if (xmlText==null){
    SelectedTable=null;
    SelectedField=null;
    refreshTablesListDOM();
    refreshFieldsListDOM();
    return;
  }
  var oParser = new DOMParser();
  var xml = oParser.parseFromString(xmlText, "text/xml");
  var root = xml.getElementsByTagName(xmlroot)[0];
  var tables = root.getElementsByTagName("table");
  for (let i = 0; i < tables.length; i++) {
    const xmltable = tables[i];
    var t = new TTable("Unknown");
    t.setFromXML(xmltable);
    ATables.push(t);
    flowdbeditor.appendChild(t.getDOM());
  }
  //for constraints
  for (let i = 0; i < ATables.length; i++) {
    const table = ATables[i];    
    table.setLinksFromTemp();
  }
  refreshTablesListDOM();
  var setup = root.getElementsByTagName("setup");
  if ((setup!=null && setup.length>0)){     
     setup=setup[0];
     var v = setup.getAttribute("idField");
     if (v!=null) 
        idField = Number(v);
     v = setup.getAttribute("idTable");
     if (v!=null) 
        idTable = Number(v);

  }
}

//SQL
var SQLdb="flowdbeditor";
var LF='\r\n';
function mySQL(linknode){
  if (ATables==null) return;
  linknode=document.getElementById(linknode);
  var source=`START TRANSACTION;`+LF+` 
  SET time_zone = "+00:00";`+LF ;
  source+=`drop database if exists `+SQLdb+`;`+LF+`  
  CREATE DATABASE IF NOT EXISTS `+SQLdb+` DEFAULT CHARACTER SET utf8 COLLATE utf8_hungarian_ci;`+LF+`
  USE `+SQLdb+`;`+LF;

  ATables.forEach(function(table,index){
    source+=`DROP TABLE IF EXISTS `+table.name+`;`+LF+` 
    CREATE TABLE `+table.name+` (`+LF;
    var fields="";
    table.AFields.forEach(function(field,index2){      
      tip= AType.SearchTypeById(field.type);
      source+='`'+field.name+'` '+tip.sql.replace("%",field.length)+','+LF ;
      fields+='`'+field.name+'`,';
    });
    fields=fields.substring(0,fields.length-1);
    source=source.substring(0,source.length-3)+LF; //utolso vesszo
    source+=`) ENGINE=InnoDB DEFAULT CHARSET=utf8;`+LF ;

    if (table.Records!=null && table.Records.length>1){
      source+=`INSERT INTO `+table.name+` (`+fields+`) VALUES `;
      table.Records.forEach(function(o,i){
        if (i>0){
            //content            
            source+=`(`;
            var value="";
            o.forEach(function(o2,i2){
              value+="'"+o2+"',";
            });
            source+=value.substring(0,value.length-1);
            source+=`),`;
        }
      });
      source=source.substring(0,source.length-1)+";"+LF;
    }
  });
  //Autoinc primary key
  ATables.forEach(function(table,index){
    var one=false;
    var s="";
    table.AFields.forEach(function(field,index2){      
      if (field.type==3) {//autoinc
        one=true;
        s += 'MODIFY `'+field.name+'` int(11) NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (`'+field.name+'`);'+LF;
      }
    });
    if (one){
      source+=`ALTER TABLE `+table.name+LF+s;
    }
  });
  //constraints
  ATables.forEach(function(table,index){
    var one=false;
    var s="";
    table.AFields.forEach(function(field,index2){ 
      if ( field.link!=null){
        one=true;
        s+='ADD CONSTRAINT `'+table.name+field.link.table.name+'` FOREIGN KEY (`'+field.name+'`) REFERENCES `'+field.link.table.name+'`('+field.link.name+'),'+LF;
      }
    });
    if (one){
      s=s.substring(0,s.length-3)+";"+LF; //utolso vesszo
      source+=`ALTER TABLE `+table.name+LF+s;
    }
  });

  source += 'COMMIT;'+LF ;
  var url = "data:application/sql;charset=utf-8,"+encodeURIComponent(source);
  linknode.href = url;
  //linknode.style.visibility="visible";
  linknode.setAttribute("download","flowdb.sql");
  linknode.innerHTML="RightClickforDownloadSQL";
  linknode.click();
}

//**************************MSSQL */
var LFGO='\r\nGO\r\n';
var mscollate = 'HUNGARIAN_CI_AS';
function MSSQL(linknode){
  if (ATables==null) return;
  linknode=document.getElementById(linknode);
  var source=`BEGIN TRAN`+LFGO;
  source+=`drop database if exists `+SQLdb+LFGO+`  
  CREATE DATABASE IF NOT EXISTS `+SQLdb+` COLLATE `+mscollate+LFGO+`
  USE `+SQLdb+LFGO;

  ATables.forEach(function(table,index){
    source+=`DROP TABLE IF EXISTS [dbo].[`+table.name+`]`+LFGO+` 
    CREATE TABLE [dbo].[`+table.name+`] (`+LF;
    var fields="";
    table.AFields.forEach(function(field,index2){      
      tip= AType.SearchTypeById(field.type);
      source+='['+field.name+'] '+tip.mssql.replace("%",field.length)+','+LF ;
      fields+='['+field.name+'],';
    });
    fields=fields.substring(0,fields.length-1);
    source=source.substring(0,source.length-3)+LF; //utolso vesszo
    source+=`) `+LFGO ;

    
    if (table.Records!=null && table.Records.length>1){
      source+=`SET IDENTITY_INSERT [dbo].[`+table.name+`] ON `+LF;
      source+=`INSERT INTO [dbo].[`+table.name+`] (`+fields+`) VALUES `;
      table.Records.forEach(function(o,i){
        if (i>0){
            //content            
            source+=`(`;
            value="";
            o.forEach(function(o2,i2){
              value+="'"+o2+"',";
            });
            source+=value.substring(0,value.length-1);
            source+=`),`;
        }
      });
      source=source.substring(0,source.length-1)+LF;
      source+=`SET IDENTITY_INSERT [dbo].[`+table.name+`] OFF `+LF;
    }
    
  });
  //Autoinc primary key
  ATables.forEach(function(table,index){
    var one=false;
    var s="";
    table.AFields.forEach(function(field,index2){      
      if (field.type==3) {//autoinc
        one=true;
        s += 'MODIFY `'+field.name+'` int(11) NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (`'+field.name+'`);'+LF;
      }
    });
    if (one){
      source+=`ALTER TABLE `+table.name+LF+s;
    }
  });
  //constraints
  ATables.forEach(function(table,index){
    var one=false;
    var s="";
    table.AFields.forEach(function(field,index2){ 
      if ( field.link!=null){
        one=true;
        s+='ADD CONSTRAINT `'+table.name+field.link.table.name+'` FOREIGN KEY (`'+field.name+'`) REFERENCES `'+field.link.table.name+'`('+field.link.name+'),'+LF;
      }
    });
    if (one){
      s=s.substring(0,s.length-3)+";"+LF; //utolso vesszo
      source+=`ALTER TABLE `+table.name+LF+s;
    }
  });

  source += 'COMMIT TRAN;'+LF ;
  var url = "data:application/sql;charset=utf-8,"+encodeURIComponent(source);
  linknode.href = url;
  //linknode.style.visibility="visible";
  linknode.setAttribute("download","flowdbms.sql");
  linknode.innerHTML="RightClickforDownloadSQL";
  linknode.click();
}

function FlowDBSave(linknode) {
  Save();
  var source=localStorage.getItem("flowdbeditor");
  var url = "data:application/sql;charset=utf-8,"+encodeURIComponent(source);
  linknode=document.getElementById(linknode);
  linknode.href = url;
  //linknode.style.visibility="visible";
  linknode.setAttribute("download","flowdb.txt");
  linknode.innerHTML="RightClickforDownloadFlowDB"; 
  linknode.click(); 
}

function FlowDBLoad(e) {
  if (!e.activ){
    alert("Please wait the autoload!");
    return;
  }

  oncehints.hint("loadfromfile");
  var input = document.getElementById("filename");
  if (input.file!=null || input.files[0]!=null)
  {
      var reader = new FileReader();
      reader.onload = function(){
        var source = reader.result;        
        //alert(source.substring(0, 200));
        localStorage.setItem("flowdbeditor",source);
        Load();
        input.form.reset();        
        e.activ=false;
        console.log(source.substring(0, 200));
      };          
      reader.readAsText(input.files[0]);
  } else {
    //alert("Please choose a file before click loadfromfile button!")
    var fil=document.getElementById("filename");
    e.activ=true;
    fil.click();
  }
  
}

function FlowDBCopy(e){ 
  var xmlText=SavetoString();
  var loc = location.href;
  if (loc.indexOf("codepen")>0){
    loc = "https://codepen.io/hgabor47/full/XqezrX/";
  } 
  navigator.clipboard.writeText(encodeURI(loc+'?flowdb='+xmlText))
  .then(() => {
    new URL(document.location);
    console.log('Text copied to clipboard');
  })
  .catch(err => {
    // This can happen if the user denies clipboard permissions:
    console.error('Could not copy text: ', err);
  });
}
//endregion LOAD/SAVE

//region BROWSE functions (LIST)  

var Divname=null;
var browsebuttonleft=true;  //left or right side
function list( tableidx , divname ){   // tomb.... és "lista"  a div id-je
  if (tableidx<0 || tableidx>=ATables.length) return ;
  if (divname==null)
    divname=Divname;
  Divname=divname;    
  var div = document.getElementById(divname);
  div.innerHTML=``;
  div.addEventListener('scroll', function(e) {
    var hdr = document.getElementById("list_header");
    hdr.style.top=(e.target.scrollTop)+'px';
  });
  if (divname!=null) //TODO New position in new table
  {    
    div.style.top=Number(window.pageYOffset)+20+"px";
    div.style.left=Number(window.pageXOffset)+30+"px";
  }

  var div2=document.createElement("div");
  div2.setAttribute("id","list_header");
  div2.className="flow_browse_header";

  div2.innerHTML=`<button onclick="list_new(`+tableidx+`)">NewRecord</button>    
  <button onclick="{commandgroup=0;editTableCancel(this.parentElement);}">Exit</button><button onclick="editTableClear(`+tableidx+`)">ClearRecords</button>`;
  var table = ATables[tableidx];
  tomb=table.Records;

  if (tomb.length>1) 
  {
    //fejlec
    var fej = document.createElement("div");
    fej.innerHTML="Sorrendezés:";
    div2.appendChild(fej);
    var opt = document.createElement("select");
    var hasOrder = false;   
    opt.setAttribute("onchange","list("+tableidx+")");
    for (let i = 1; i < tomb[0].length; i++) {
        const hdr = tomb[0][i];
        //if (hdr.indexOf("_s")>0) 
        {
            var b  = document.createElement("option");
            b.value=i;
            if (hdr==null){
              b.innerHTML="Empty";
            } else {
              b.innerHTML=hdr.replace("_s","");
            }
            //if (i==order){
            //    b.setAttribute("selected","");
            //}
            opt.appendChild(b);
            hasOrder=true;
        }
    }
    if (hasOrder){
        fej.appendChild(opt); 
    }
  }
  {
    div.appendChild(div2);
    //tartalom
    var t = document.createElement("table");
    t.className="table";
    div.appendChild(t);

    var combo=null;
    if (constraintList){
      //preprocess
      combo=[];
      table.AFields.forEach(function(o,i){
        if (o.link!=null){
          combo.push( getTable(o.link.table) ); //0,1  idx,name
        } else {
          combo.push(null);
        }
      });
    }
    var start=0;
    if ((table.AFields.length>0) && (table.AFields[0].type==3)) {
      start =  1;
    } //autoinc
    for (let i = 0; i < tomb.length; i++) {
        const sor = tomb[i];
        var r = document.createElement("tr");
        if (i==0){
            r.setAttribute("class","flow_rec_header");
        }
        t.appendChild(r);
        if ((browsebuttonleft) && (i==0)){
          var c= document.createElement("td");
          r.appendChild(c);
        }
        
        if ((browsebuttonleft) && (i>0)){
          var c= document.createElement("td");
          r.appendChild(c);
          var s3 = "'"+sor[0]+"'";
          c.innerHTML='<button onclick="list_edit(this,'+tableidx+','+s3+')">Edit</button><button onclick="list_del(this,'+tableidx+','+s3+')">Delete</button>';      
        }

        //r.setAttribute("sqlid",sor[0]);
        for (let j = start; j < sor.length; j++) {
            var cell=sor[j];
            if ((i==0) || (combo==null) || (combo[j]==null)){
              cell = sor[j];
            }else {
              //comboj !=null
              var t2=combo[j];
              try {
                //lookup
                cell = t2.find( fi => fi[0] == cell )[1];  
              } catch (error) {
              }                                
            }
            var c= document.createElement("td");
            r.appendChild(c);
            if (cell==null) { cell = ""};
            c.innerHTML=cell;
        }          
        if ((!browsebuttonleft) && (i>0)){
            var c= document.createElement("td");
            r.appendChild(c);
            var s3 = "'"+sor[0]+"'";
            c.innerHTML='<button onclick="list_edit(this,'+tableidx+','+s3+')">Edit</button><button onclick="list_del(this,'+tableidx+','+s3+')">Delete</button>';      
        }
    }
  }  
  var hdr = document.getElementById("list_header");    
  if (hdr!=null)
    hdr.style.top=(div.scrollTop)+'px';            
}

//0,1,......  [idx,name]
//lookup table with concatenated names 
function getTable(table,filterfieldname) {
  var filtidx=null;
  var records=[];    
  var displayidx=[]; //displayfield if was set  [ [1,null],[3.null],.... ]
  for (let i = 0; i < table.AFields.length; i++) {    
    if (table.AFields[i].name==filterfieldname){
      filtidx=i;
    }
    if (table.AFields[i].display==true){
      if (table.AFields[i].link==null){        
        displayidx.push([i,null]);
      } else {
        displayidx.push([i,
          getTable(table.AFields[i].link.table,filterfieldname)
        ]);
      }
    }
  }    
  if (displayidx.length>0){      
    Array.prototype.forEach.call(table.Records,function(o,i){
        if (i>0){
          var sor=Array(2);
          sor[0]=o[0];
          sor[1]="";
          if (filtidx!=null){
            sor.filtervalue=o[filtidx];
          }
          displayidx.forEach(function(oi){
            if (oi[1]==null){
              sor[1]+=o[oi[0]]+" ";
            } else {
              //linked oi[1]
              var res=null;
              var t = oi[1]; //tablerecs from getTables [idx,name]
              for (let i = 0; i < t.length; i++) {
                var fi=t[i];
                if (o[oi[0]]==fi[0]){
                  res = fi; 
                  break;
                }
              }
              if (res==null){
                sor[1]+=o[oi[0]]+" ";
              } else {
                sor[1]+=res[1];
              }
              

              //sor[1]+=oi[1].find( fi => fi[0] == oi[0] )[1];
            }
          }); 
          records.push(sor);
        }
      });
  }else {
    Array.prototype.forEach.call(table.Records,function(o,i){
      if (i>0){
        var sor=Array(2);
        sor[0]=o[0];
        sor[1]="";
        if (filtidx!=null){
          sor.filtervalue=o[filtidx];
        }
        o.forEach(function(o2,i2){
          if (i2>0){
            sor[1]+=o2+" ";
          }
        });
        records.push(sor);
      }
    });
  }
  return records;
}

function list_addrecordheader(table) {
  if (table.Records.length<1)
  {
    var sor=[];
    for (let i = 0; i < table.AFields.length; i++) {
      const fi = table.AFields[i];
      fi.autoinc=AUTOINCTSTART;
      sor.push(fi.name);  
    }
    table.Records.push(sor);  
  }
}

//region BROWSE LIST BUTTONS
function list_new(tableidx) {
  if ((tableidx<0) || (tableidx>=ATables.length)) 
    return ;
  var t = ATables[tableidx];
  list_addrecordheader(t);
  var sor=[];
  for (let i = 0; i < t.AFields.length; i++) {
    const fi = t.AFields[i];
    if (fi.type==3){        
      sor.push(fi.autoinc++);  
    } else {
      sor.push("Empty");
    }
  }
  t.Records.push(sor);
  //t.Records.push(new Array(t.AFields.length));
  list(tableidx,null);
  return sor[0];
}
function list_edit(e,tableidx,id) {
  //var r = e.parentElement;
  if ((tableidx<0) || (tableidx>=ATables.length)) 
    return ;
  var t = ATables[tableidx];
  //var rec = t.Records.find()
  const rec = t.Records.find( fi => fi[0] == id );
  
  var div = document.createElement("div");
  div.id=t.name+id;
  div.className="flow_edit";
  div.innerHTML="";

  var fi = t.AFields;
  fi.forEach(function(f,idx){
    if (f.link==null){
      if (f.type==7){ //bool
        div.innerHTML+=ComboBoxYesNoDOM(rec[idx],f);
      } else if (f.type==3){ //autoinc
        div.innerHTML+=`<label>`+f.name+`</label><div>`+rec[idx]+`</div>`;
      } else {
        var typ=AType.SearchTypeById(f.type);                
        div.innerHTML+=`<label>`+f.name+`</label><input type="`+typ.inputtype+`" id="`+t.name+f.name+`" value="`+rec[idx]+`"><br>`;
      }
    } else {
      div.innerHTML+=ComboBoxDOM(rec[idx],f,f.link);
    }
  });
    div.innerHTML+=`<button onclick="listEditOK(this)">OK</button>
    <button onclick="listEditCancel(this)">Cancel</button>     
    `;
  div.table=t;
  div.rec=rec;
  document.body.appendChild(div);
}
function listEditOK(e){
  var div = e.parentElement;
  var t=div.table;
  for (let i = 0; i < div.table.AFields.length; i++) { //and div.REC has same element
    const f = t.AFields[i];      
    var o=document.getElementById(t.name+f.name);
    if (o!=null){
      div.rec[i]=o.value;
    }
  }
  removePanelDOM(e);
  list(ATables.indexOf(t),null);
}
function listEditCancel(e){
  //var div = e.parentElement;
  removePanelDOM(e);
  //list(ATables.indexOf(div.table),null);
}
function list_del(e,tableidx,id) {
  //var div = e.parentElement;//List
  if ((tableidx<0) || (tableidx>=ATables.length)) 
    return ;
  var t = ATables[tableidx];
  t.Records.forEach(function(o,i){
    if ((i>0) && (o[0]==id)){
      if (confirm("I Will DELETE RECORD! Sure?")) {
        t.Records.splice(i,1);
        //removePanelDOM(div);
        list(ATables.indexOf(t),null);
      }
    }
  });
  //const rec = t.Records.find( fi => fi[0] == id );
}
function editTableClear(tableidx){
  var t = ATables[tableidx];
  if (t){
    t.Records=[];
    list_addrecordheader(t);
    list(tableidx,null);
  }
}
//endregion BROWSE LIST BUTTONS

function ComboBoxYesNoDOM(value,field1) {
  var opt = `<label>`+field1.name+`</label><select id="`+field1.table.name+field1.name+`">`;
  opt+=`<option `;
  if (value==0) {
    opt+=`selected `;
  }
  opt+=`value="0">Nem</option>`;
  opt+=`<option `;
  if (value==1) {
    opt+=`selected `;
  }
  return (opt+=`value="1">Igen</option></select><br>`);
};

function ComboBoxDOM(value,field1,field2){    
  var filtered=field1.linkfilter[0];
  var min=field1.linkfilter[1];
  var max=field1.linkfilter[2];
  var filterfield=field1.linkfilter[3];  
  var num =false; // ai intervallum kereséshez szám kell
  switch (field1.type) {
    case 1:
    case 2:
    case 3:
      num=true;
      min=Number(field1.linkfilter[1]);
      max=Number(field1.linkfilter[2]);      
      break;
    default:
      break;
  }
  var opt = `<label>`+field1.name+`</label><select id="`+field1.table.name+field1.name+`">`;
  var t=null;
  if (filtered){
    t = getTable(field2.table,filterfield);
  } else {
    t = getTable(field2.table);
  }
  for (let i = 0; i < t.length; i++) {    
    const e = t[i];
    var id = e[0];
    var filt=e.filtervalue;
    if(num){
      try {
        filt=Number(filt);
      } catch (error) {
      }
    }
    if ((!filtered) ||                          //if no filter = all values
        ((filtered) && (                        //if filter,
          (num && (filt<=max) && (filt>=min)) ||      //and numeric = interval
          (!num && ((filt==min) || (filt==max)))      //and string = val1 or val2
        ))
      ) 
    {
      if (value==id){        
        opt+=`<option selected `;  
      }else {
        opt+=`<option `;  
      }
      opt+=`value="`+id+`">`+e[1]+`</option>`;
    }
  }
  return (opt+`</select><br>`);
};



//#endregion BROWSE functions (LIST) 


//region SPEECH 

function AI(){
  window.SpeechRecognition = window.SpeechRecognition || webkitSpeechRecognition;
  var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList;
	const recognition = new SpeechRecognition();
  /*
  var grammar = '#JSGF V1.0; grammar flowbrick; public <flowbrick> = table | field | create | 1 | 2 | 3 | 4 | 5 | 7 | 8 | 9 | 10 | link | clear | select | hét ;'  ;
  var speechRecognitionList = new SpeechGrammarList();
  speechRecognitionList.addFromString(grammar, 1);
  recognition.grammars = speechRecognitionList;
  */
  //recognition.lang = 'en-US';
  recognition.lang = 'hu-HU';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

	recognition.addEventListener('result', e => {
		const speechTotext = Array.from(e.results)
			.map(result => result[0])
			.map(result => result.transcript)
			.join('');
			
			if (e.results[0].isFinal) {
        robot(speechTotext);
			}
	});

	recognition.addEventListener('end', recognition.start);
  recognition.start();
}

var commands = [
  [ //0
  /*OK*/[1,"create 4 tables"],[1,"create 4 table"],[1,"create a table"],[1,"4 tables create"],[1,"készíts 4 táblát"],[1,"szeretnék 4 táblát"],[1,"készíts 4 új táblát"],[1,"kérek 4 új táblát"],[1,"csinálj 4 új táblát"],[1,"adj 4 új táblát"],
  /*OK*/[2,"create 4 field"],[2,"create 4 fields"],[2,"készíts 4 mezőt"],[2,"készíts 4 új mezőt"],[2,"kérek 4 új mezőt"],[2,"csinálj 4 új mezőt"],[2,"adj 4 új mezőt"],[2,"új 1 mező"],
  [3,"link"],
  /*OK*/[4,"clear all tables"],[4,"törölj ki minden táblát"],[4,"töröld a táblákat"],[4,"töröld ki az összes táblát",0.1],
  /*OK*/[7,"rename table to"],[7,"új tábla név"],[7,"nevezd át a táblát%nevűre"],[7,"nevezd át%nevűre"],[7,"átnevezés"],[7,"nevezd át"],[7,"tábla neve%"],[7,"a tábla név%"],[7,"az új tábla név%"],
  /*OK*/[5,"delete table"],[5,"töröld a táblát"],[5,"tábla törlése"],[5,"törlés"],[5,"a%tábla törlése"],
  /*OK*/[6,"select new table"],[6,"új tábla"],[6,"kérem az egyik új táblát"],[6,"új tábla kiválasztása"],[6,"válaszd ki az új táblát"],
  /*OK*/[8,"select table"],[8,"select table called"],[8,"tábla kiválasztása"],[8,"tábla választás"],[8,"válaszd ki a%táblát"],
  /*OK*/[9,"add string field"],[9,"add integer field"],[9,"add date field"],[9,"add boolean field"],[9,"kérek 1 integer mezőt"],[9,"új integer mező"],[9,"kérek 1 string mezőt"],[9,"új string mező"],[9,"kérek 1 boolean mezőt"],[9,"új boolean mező"],[9,"új date mező"],[9,"kérek 1 date mezőt"],
  [10,"rename field to"],[10,"legyen a mező neve"],[10,"a mező neve"],[10,"a mezőnév"],[10,"az új mezőnév"],
  [11,"the new name of table is"],[11,"the new table's name is"],[11,"the new table called"],[11,"az új tábla neve"],
  [12,"connect from % to %"],[12,"kösd össze a%és%táblákat"],[12,"kapcsold össze a%és%táblákat"],[12,"kösd össze a%és a%táblákat"],[12,"kapcsold össze a%és a%táblákat"],[12,"kösd össze a% táblát a%táblával"],
  [13,"double size"],[13,"dubla méret"],[13,"dubla széles"],
  [14,"half size"],[14,"kisebb méret"],[14,"fele méret"],
  [15,"köszönöm"],[15,"thank"],[15,"thank you"],
  [16,"data entry"],[16,"adatfelvétel"],
  ],
  [ //1 browse
    [1000,"új sor"],[1000,"new record"],[1000,"új rekord"],
    [1001,"exit"],[1001,"kilépés"],
  ]
];
var change = [["igen","yes"],["nem","no"],["free","3"],["form","4"],["cleared","create"],["tree","3"],["for","4"],["hive","5"],["one","1"],["two","2"],["too","2"],["six","6"],["sex","6"],
 ["84 bus","8 tables"],["timetables","10 tables"],["grade","create"],["portable","4 tables"],["turntables","10 tables"],["neighbour","table"],["you","new"],
 [" egy "," 1 "],["névtáblát","4 táblát"],[" kettő "," 2 "],[" négy "," 4 "],[" három "," 3 "],[" öt "," 5 "],[" hat "," 6 "],[" hét "," 7 "],[" nyolc "," 8 "],[" kilenc "," 9 "],[" tíz "," 10 "],
 ["logikai","boolean"],["szám","integer"],["stream","string"],["sztring","string"],["dátum","date"],["audi","id"],["díj","id"],["agy","adj"]
 ];

var TSPHistory = function(limit=20,timelimit=3000){ //pieces,ms
  this.limit=limit;
  this.timelimit=timelimit;
  this.verem=[];
  this.mode=null;  
  this.add=function (p,mode=null) {    
    this.verem.push(p);
    if (mode!=null) this.mode=mode;
    if (this.verem.length>this.limit){
      this.verem=this.verem.splice(1);
    }
    this.time=(new Date()).getTime();
  };
  this.last=function() {
    return this.verem[this.verem.length-1];
  };
  this.ellapsed=function(){
    if ((this.time+timelimit)<(new Date()).getTime()) return true;   
    return false; 
  };
};
var SPHistory = new TSPHistory();


var speechlevel=0;
var commandgroup=0; //commands[0]
function robot(command){
  if ((document.activeElement!=null)){
    if ((document.activeElement.nodeName=="INPUT") ||  ((document.activeElement.nodeName=="TEXTAREA"))){
      var s = document.activeElement.value;
      s=s.slice(0,document.activeElement.selectionStart)+command+s.slice(document.activeElement.selectionEnd,23452345245425);      
      document.activeElement.value = s;
      return;
    }
  }

  command=command.toLowerCase();
  for (let i = 0; i < change.length; i++) {
    const chg = change[i];
    command=command.replace(chg[0],chg[1]);
  }
  if (speechlevel!=0){
    //all text transfer
    processSpeech(-1,command,0,null);
  }
  var mini=-1;
  var minv=10;
  var minparams=[];
  for (let i = 0; i < commands[commandgroup].length; i++) {
    var minta=commands[commandgroup][i][1];
    var egyezes=0.3;
    if (commands[commandgroup][i][2]!=null){
      egyezes = commands[commandgroup][i][2];
    }        
    var c = minta.indexOf("%");
    if (c>0){ //more parts split by %
      var parts=minta.split("%");
      var cmd=command;
      var dst=0;
      var chrs=0;
      var res=null;
      var minip=[];
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];        
        res = getEditDistance2(p,cmd);  //(part,cmd) ->  [dist,chars,newcmd,%paramvalue]
        if (res==null){
          break;
        }
               
        dst+=res[0];
        chrs+=res[1];
        cmd=res[2];
        minip.push(res[3]);        
        if (cmd==null){
          break;
        } 
      }
      if (res!=null){
        var sym=dst/chrs;//similarity
        if ((sym<egyezes) && (sym<minv)){
          mini=i;
          minv=sym; 
          minparams=minip;         
        }
      }
    }else {
      if (command.startsWith(minta)) {
        mini=i;
        minv=-1;
        break;
      } else {   
        var sym=getSimilarity(commands[commandgroup][i][1], command);
        if ((sym<egyezes) && (sym<minv)){
          mini=i;
          minv=sym;
        }
      }
    }
  }  
  
  if (minv<egyezes){
    console.log(commands[commandgroup][mini][1],command);
    processSpeech(mini,command,minv,minparams);
  } else {
    console.log(minv,command);
    if (!SPHistory.ellapsed()){
      command=command.split(" ")[0]; //only one word
      switch (SPHistory.mode){
        case 1:
          SP_renametable(0,0,0,[command]); 
          break;
        case 2:
          SP_renamefield(0,0,0,[command]); 
          break;
        default:
          break;

      }
    }
  }
}




function processSpeech(idx,command,minv,minparams=null){
  if (idx>-1){ //yes or no -1
    var cases=commands[commandgroup][idx][0];
    SPHistory.add([idx,command,minv,minparams],cases);
  }
  if (speechlevel>0){
    cases=speechlevel;    
  }
  switch (cases){
    case 1: //TODO Tablemaker
      SP_maketables(command.match(/\d/g));      
      break;
    case 2: //TODO Fieldmaker
      SP_makefields(command.match(/\d/g));
      break;
    case 9: //add typed fields
      SP_addfield(idx,command);
      break;
    case 3: //TODO link
      break;
    case 4: //Clear tables
      Load('alma');
      break;
    case 5:
      SP_deletetable(idx,command);
      break;
    case 8: 
      SP_selecttable(idx,command,minv,minparams);
      break;
    case 6: //TODO select NEW table
      SP_selectnewtable();
      break;
    case 11:
      SP_selectnewtable();
      SP_renametable(idx,command,minv,minparams);
      break;  
    case 7:
      SP_renametable(idx,command,minv,minparams);
      break;
    case 10:
      SP_renamefield(idx,command,minv,minparams);
      break;  
    case 12:
      SP_link(idx,command,minv,minparams);
      break;
    case 13:
      SP_newtablesize(2);
      break;
    case 14:
      SP_newtablesize(0.5);
      break;
    case 15:
      SP_smile();
      break;
    case 16:
      SP_adatfelvitel();
      break;

      case 1000:
      SP_adatfelvitel_new();
      break;
      case 1001:
      SP_adatfelvitel_exit();
      break;

    default:
      
      break;
  }
}

function SP_adatfelvitel(params) {
  if (SelectedTable){
    commandgroup=1;    
    SelectedTable.browse(document.getElementById("area"));
  }  
}

function SP_adatfelvitel_new(){
  if (SelectedTable){
    var idx = ATables.indexOf(SelectedTable);
    var sorid = list_new(idx);
    list_edit(this,idx,sorid);
  }
}

function SP_adatfelvitel_exit() {
  editTableCancel(document.getElementById("list").childNodes[0]);
  commandgroup=0;  
}

function SP_smile(){
  var img = document.getElementById("smile");
  if (img!=null){
    img.src = "";
    img.src = imgs+"smile.gif";
    img.style.opacity=1.0;
    img.style.visibility="visible";
    var a= function(){
      img.style.opacity=img.style.opacity-0.03;
      if (img.style.visibility=="visible")
        window.setTimeout(a, 50);  
    }
    window.setTimeout(a, 100);
    window.setTimeout(function(){
      img.style.visibility="hidden";
    },2000);
  }

}

function SP_newtablesize(szorzo){
  if (SelectedTable){
    SelectedTable.width=Math.floor(SelectedTable.width*szorzo);
    SelectedTable.refreshDOM();
  }
}

function SP_link(idx,command,minv,minparams){
  if (idx<0) return;  
  if (idx>=commands[commandgroup].length) return;
  if ((minparams!=null) && (minparams.length>1)) {
    var id2="id";
    var id1="id"+minparams[1];
    var t1=SearchTableByName(minparams[0]);
    var t2=SearchTableByName(minparams[1]);
    if ((t1!=null)&&(t2!=null)){
      var f1 = t1.AFields.SearchFieldByName(id1);
      var f2 = t2.AFields.SearchFieldByName(id2);
      if (f1==null){ //null??
        f1 = t1.addField(id1,1);
        t1.refreshFields();
      }
      if (f2==null){ //null??
        f2 = t2.addField(id2,3);
        t2.refreshFields();
      }
      f1.addLink(f2);
      t1.refreshConstraints();
    }
  }
}

function SP_maketables(num){
  num=Math.min(10,Math.abs(Math.floor(num)));
  var table=null;
  for (let i = 0; i < num; i++) {
    table = newTable();  
    table.moveToPosition((i*10)+(Math.floor(Math.random()*8)*120),Math.floor(Math.random()*4)*130);
  }
  if (table!=null)
    table.Selected();
  return num;  
}

function SP_makefields(num){  
  if (SelectedTable!=null){
    SelectedField=null;
    num=Math.min(10,Math.abs(Math.floor(num)));
    if (num<1) num=1;
    var f=null;
    for (let i = 0; i < num; i++) {
      f=SelectedTable.addField("Field"+(idField++),0);
      if (SelectedField==null) {
        SelectedField=f;//first field selected
      } 
    }
    SelectedTable.refreshFields();
    refreshFieldsListDOM();
    return num;
  }
  return 0;
}

function SP_addfield(idx,command){
  if (SelectedTable==null) return;
  var f=null;
  if (command.indexOf("integer")>0){
    f = SelectedTable.addField("Field"+(idField++),0);
    f.setType(1);
    f.length=0;
  }else if (command.indexOf("string")>0){
    SelectedTable.addField("Field"+(idField++),0);    
  } else if (command.indexOf("boolean")>0){
    f = SelectedTable.addField("Field"+(idField++),0);
    f.setType(7);
    f.length=0;  
  } else if (command.indexOf("date")>0){
    f = SelectedTable.addField("Field"+(idField++),0);
    f.setType(4);
    f.length=0;
  } 
  SelectedField=f;
  SelectedTable.refreshFields();
  refreshFieldsListDOM();
}

function SP_selectnewtable() {
  const t = ATables.find( tab => tab.name.toLowerCase().indexOf("unknown")==0 );
  if (t!=null) {
    t.Selected();
  } else {
    SP_maketables(1);
  }
}


function SP_deletetable(idx,cmd) {
  if (SelectedTable!=null){
    if (speechlevel!=0){
      speechlevel=0; //agree
      document.getElementById("yesno").style.visibility="hidden";
      if (cmd=="yes"){
        var index = ATables.indexOf(SelectedTable);
        if (index > -1) {
          //var div = ATables[index].DOMGroup;
          ATables.splice(index, 1);
          //div.parentElement.removeChild(div);
          SelectedTable.destroy();
          SelectedTable=null;
          SelectedField=null;
          refreshTablesListDOM();          
          Save(temp);
        }
      }
    } else {
      speechlevel=commands[commandgroup][idx][0];
      document.getElementById("yesno").style.visibility="visible";
    }  
  }
    
}

function SP_selecttable(idx,cmd,minv,minparams) {
  if (idx<0) return;  
  if (idx>=commands[commandgroup].length) return;
  if ((cmd==null) || (cmd==""))  return;
  var t=null;
  if ((minparams!=null) && (minparams.length>0)) {
    if (typeof(minparams)=="object"){
      t = ATables.SearchTableByName(minparams[0]);
      if (t!=null)
        t.Selected(); 
    }
  }else {
    if (minv<0){
      cmd=cmd.replace(commands[commandgroup][idx][1],"");
      cmd=cmd.trim();
      if (cmd=="") return;
      if (cmd.indexOf("unknown")==0){
        cmd=cmd.replace(" ","");
      }
      t = ATables.SearchTableByName(cmd.replace(" ","_"));
      if (t!=null)
        t.Selected();
    }
  }
}

function SP_renametable(idx,cmd,minv,minparams){  
  if (idx<0) return;
  if (idx>=commands[commandgroup].length) return;

  if (SelectedTable!=null){
    if ((minparams!=null) && (minparams.length>0)){
      try {
        if (minparams[0]!="")
          SelectedTable.setName(minparams[0].replace(" ","_"));  
      } catch (error) {        
        console.log(minparams);
      }      
    }else {
      if (minv<0){
        cmd=cmd.replace(commands[commandgroup][idx][1],"");
        cmd=cmd.trim();        
        if (cmd!="")
          SelectedTable.setName(cmd.replace(" ","_"));
      }
    }      
  }
}

function SP_renamefield(idx,cmd,minv,minparams) {
  if (idx<0) return;
  if (idx>=commands[commandgroup].length) return;
  if (SelectedTable!=null){
    if (SelectedField!=null){
      if ((minparams!=null) && (minparams.length>0)){
        try {
          SelectedField.setName(minparams[0].replace(" ","_"));  
        } catch (error) {        
          console.log(minparams);
        }      
      }else {
        if (minv<0){
          cmd=cmd.replace(commands[commandgroup][idx][1],"");
          cmd=cmd.trim();        
          SelectedField.setName(cmd.replace(" ","_"));
        }
      }   
    }
  }
}

//endregion SPEECH 
