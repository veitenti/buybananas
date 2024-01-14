/*jshint nonew:true, jquery:true, curly:true, latedef:nofunc, noarg:true, indent:4, trailing:true, forin:true, quotmark:true, eqeqeq:true, strict:true, undef:true, bitwise:true, newcap:true, immed:true, browser:true, camelcase:true, nonbsp:true, freeze:true, globalstrict:true */

/*global jQuery, $, Inneractive, console, Suggest */


"use strict";

//////////////////////////////////////////////////////////////////////// CLASSES

// Objects
function Item(name, category) {
    this.type = "item";
    this.name = name;
    this.done = false;
    this.currentTime = 0;
    this.time = {};
    this.category = category;
    this.version = 1;  // undefined means 0
    this.howmany = 0;
    this.lastPurchases = [0, 0, 0];
    this.suggestable = true;
    this.seasonStart = undefined;
    this.seasonEnd = undefined;
}
function Shop(name) {
    this.type = "shop";
    this.name = name;
    this.visits = 0;
}
function Category(id, label, color, icon) {
    this.id = id;
    this.label = label;
    this.color = color;
    this.icon = icon;
}
function Settings(language) {
    this.language = language;
    this.southernHemisphere = false;
}

/////////////////////////////////////////////////////////////// GLOBAL VARIABLES

var _ = document.webL10n.get;  // localization shortcut

var items = {};
var suggestions = {};
var shops = {};
var settings = {};

var activeShop;
var tourStartTime;
var itemsSortedForShopping = [];

var currentTab = "#itemList";  // inital tab
var pageHistory = [];  // e.g. ["#changeList", "#about", "#shopSelector"]
var selectedItem;  // item selection as jquery object
var selectedItemName;  // name of item selection as string

var categories = [
    new Category( 0, "fruits", "#cae6a1", "icons/categories/fruits.png"),
    new Category( 1, "vegetables", "#a6d959", "icons/categories/vegetables.png"),
    new Category( 2, "meat", "#f77474", "icons/categories/meat.png"),
    new Category( 3, "chiller-cabinet", "#eeeeee", "icons/categories/chiller-cabinet.png"),
    new Category( 4, "sweets", "#a255d9", "icons/categories/sweets.png"),
    new Category( 5, "bread", "#ffe35e", "icons/categories/bread.png"),
    new Category( 6, "noodles", "#fff2b3", "icons/categories/noodles.png"),
    new Category( 7, "beverages", "#5d8fff", "icons/categories/beverages.png"),
    new Category( 8, "drugstore-products", "#5e47bb", "icons/categories/drugstore-products.png"),
    new Category( 9, "snacks", "#dcbb5a", "icons/categories/snacks.png"),
    new Category(10, "frozen", "#b3caff", "icons/categories/frozen.png"),
    new Category(11, "canned-food", "#abbedf", "icons/categories/canned-food.png"),
    new Category(12, "bakery-products", "#bd9c64", "icons/categories/bakery-products.png"),
    new Category(13, "breakfast", "#dbcbaf", "icons/categories/breakfast.png"),
    new Category(14, "housewares", "#52a39b", "icons/categories/housewares.png"),
    new Category(15, "others", "#555555", "icons/categories/others.png")
];  // available categories
var seasonProducts = [
    [8, 11, "apples"],
    [7, 9, "mirabelles"],
    [7, 9, "brambles"],
    [7, 10, "string-beans"],
    [7, 8, "apricots"],
    [10, 4, "corn-salad"],
    [6, 8, "raspberries"],
    [6, 8, "cherries"],
    [6, 8, "currants"],
    [8, 11, "pumpkin"],
    [6, 9, "blueberries"],
    [5, 7, "strawberries"],
    [4, 6, "rhubarb"],
    [4, 6, "asparagus"],
    [6, 10, "tomatoes"],
    [8, 9, "water-melon"],
    [9, 10, "grapes"],
    [7, 10, "plums"],
    [7, 9, "prunes"],
    [8, 10, "pears"]
];  // season products -> [startMonth, stopMonth, id]

var htmlInputSuggestions = [];  // items to suggest when adding a new item
var suggestingElement;

/////////////////////////////////////////////////////////////////////////// INIT

// Document ready
function init() {

    // Load all stored data from localStorage
    loadState();

    // Remove items that are set to done (if app was closed during shopping)
    var activeItems = {};
    for(var name in items) {
        if(items.hasOwnProperty(name)) {
            var item = fromStorage(name);
            if(!item) {
                continue;
            }
            if(item.done === false) {
                activeItems[name] = true;
            } else {
                item.done = false;
                toStorage(item);
            }
        }
    }
    items = activeItems;

    createCategoriesPageFor("add");
    createCategoriesPageFor("change");

    // Register general callback functions
    registerButtonCallbacks();
    registerBodyCallbacks();
    registerSettingsCallbacks();
    registerHeaderCallbacks();
    registerHardwareButtonCallbacks();
    window.onresize = resize;
    resize();

    // Init the list selector
    updateHtmlShopSelector();

    // Save before closing
    $(window).unload(function() {
        saveState();
    });

    initAds();

    // Add all season products to localStorage if not already done
    seasonProducts.forEach(function(entry) {

        // Season suggestions are marked with _ to indicate that they have to be translated before displaying them
        var name = "_" + entry[2];

        if(!fromStorage(name)) {
            var newItem = new Item(name, 0);
            newItem.seasonStart = entry[0];
            newItem.seasonEnd = entry[1];
            toStorage(newItem);
        }
    });
}
$(document).ready(init);
document.webL10n.ready(function() {

    switchToTab(currentTab);  // initial tab

    // Translate the other switches as well
    $("#hemisphereSwitch").text(settings.southernHemisphere ? _("south") : _("north"));

    $("#languageSwitch").text(_("language-code"));
});

function initAds() {

    // Inneractive
    /*    var options = {
     TYPE: "Interstitial",
     REFRESH_RATE: 30,
     APP_ID: "Mozilla_AppTest_other"
     };
     var myAd = Inneractive.createAd(options);
     myAd
     .placement("top", "left")
     .addTo(document.body);*/
}

// Polyfill
if (!String.prototype.endsWith) {
    Object.defineProperty(String.prototype, "endsWith", {
        value: function (searchString, position) {
            var subjectString = this.toString();
            var pos = position;
            if (pos === undefined || pos > subjectString.length) {
                pos = subjectString.length;
            }
            pos -= searchString.length;
            var lastIndex = subjectString.indexOf(searchString, pos);
            return lastIndex !== -1 && lastIndex === pos;
        }
    });
}
if (!String.prototype.contains) {
    Object.defineProperty(String.prototype, "contains", {
        value: function(str, startIndex) {
            return "".indexOf.call(this, str, startIndex) !== -1;
        }
    });
}

////////////////////////////////////////////////////////////////////// FUNCTIONS

// Register callback functions
function registerItemCallbacks() {

    function changeItem(name) {
        console.log("Changing item "+name);
        selectedItemName = name;
        $("#itemToChange").text(name);
        switchToTab("#changeItem");
    }

    var par = $("#items").find("p");  // item

    par.on("click", function(event) {

        if(activeShop !== null && activeShop !== undefined) {
            setDone($(this));
        } else {

            // Handle tap on suggestions, activate
            if ($(this).hasClass("suggestion")) {

                selectedItem = $(this);
                var seasonId = selectedItem.attr("seasonId");

                if(seasonId) {
                    console.log("activating suggestion with id "+seasonId);
                    items["_"+seasonId] = true;
                    delete suggestions["_"+seasonId];
                } else {
                    console.log("activating suggestion "+selectedItem.html());
                    items[selectedItem.html()] = true;
                    delete suggestions[selectedItem.html()];
                }

                // Remove the suggestion css class
                $(this).removeClass("suggestion");

                switchToTab("#itemList");
            } else {

                // Normal item (no suggestion)
                selectedItem = $(this);
                changeItem(selectedItem.html());
            }
        }
        event.preventDefault();
    });  // normal tap

    par.on("contextmenu", function(e) {
        selectedItem = $(this);
        changeItem(selectedItem.html());
        e.preventDefault();
    });
}
function registerHeaderCallbacks() {

    $(".tabs a").on("click", function(e) {  // Handle clicks on the tab bar
        switchToTab($(this).attr("href"));
        e.preventDefault();
    });
}
function registerBodyCallbacks() {

    var body = $("body");

    var closeMenu = function(event) {
        if(!(event.target+"").endsWith("#menu")) {
            $("#menu").hide();
        }
    };

    body.on("click", function(e) {
        closeMenu(e);
    });
}
function registerShopSelectorCallbacks() {

    function changeShop(name) {
        console.log("changing shop "+name);
        $("#shopToChange").text(name);
        $("#shopToDelete").text(name);
        switchToTab("#changeShop");
    }

    // Change shop
    $("#shopSelectorBody").find("a").on("contextmenu", function(event) {
        changeShop($(this).html());
        event.preventDefault();
    });
    $("#shopSelectorBody").find("a").on("click", function(event) {
        changeShop($(this).html());
        event.preventDefault();
    });

    // Select shop for shopping (start shopping)
    $("#startShoppingShopSelector").find("a").on("click", function(event) {

        tourStartTime = Date.now();
        activeShop = $(this).html();
        console.log("Started shopping in "+activeShop+" at time "+tourStartTime);

        // Sort the items in the shopping list according to the times stored for this shop
        itemsSortedForShopping = sortItemsByTime();

        // Color the shopping button red to indicate that a shopping tour
        // is running that can be cancelled and change the link
        var shoppingButton = $("#shoppingButton");
        shoppingButton.css("color", "red");
        shoppingButton.attr("href", "#finishShopping");

        switchToTab("#itemList");
        event.preventDefault();

        // Hide the + button
        $("#addItemButton").hide();
    });
}
function registerButtonCallbacks() {

    $(".categories").find("table").find("td").on("click", function() {
        var selectedCategory = $(this).attr("id").split("-")[1];  // e.g. "cat-2-add" or "cat-3-change"
        console.log(selectedCategory);
        console.log("Clicked item category: "+selectedCategory);

        if(currentTab === "#addItem") {
            var element = document.getElementById("newItemName");
            var name = element.value;
            element.value = "";

            if(name === "" || name === "items" || name === "suggestions" || name === "shops" || name === "language") {
                toast(_("invalid-name"));
                return;
            }

            // Check if the added item is one of the season items
            seasonProducts.forEach(function (item) {
                if(_(item[2]) === name) {
                    name = "_"+item[2];
                }
            });

            // Prevent adding of the same item twice
            if(items[name]) {
                console.log("Prevented adding of an item that already exists");
                toast(_("list-already-contains-item")+" "+name);
                return;
            }

            var item = fromStorage(name);
            if(item === undefined || item === null) {
                item = new Item(name, selectedCategory);
            }
            item.category = selectedCategory;
            item.done = false;
            item.suggestable = true;
            toStorage(item);
            items[item.name] = true;

            switchToTab("#itemList");

        } else if(currentTab === "#changeItem") {
            var itemToChange = fromStorage(selectedItemName);
            itemToChange.category = selectedCategory;
            itemToChange.version = 1;
            toStorage(itemToChange);
            switchToTab("#itemList");
        }
    });

    $("#buttonAddShop").on("click", function() {
        var addedShopNameElement = document.getElementById("addedShopName");
        var newShop = addedShopNameElement.value;
        if(newShop === "") {
            toast(_("invalid-name"));
            return;
        }
        console.log("Adding shop "+newShop);
        localStorage.setItem(newShop, JSON.stringify(new Shop(newShop)));
        shops[newShop] = true;
        addedShopNameElement.value = "";
        updateHtmlShopSelector();
    });

    $("#buttonDeleteShop").on("click", function() {
        activeShop = $("#shopToDelete").html();
        console.log("Deleting shop "+activeShop);
        delete shops[activeShop];
        localStorage.removeItem(activeShop);
        updateHtmlShopSelector();

        // Delete all references to this shop in all items
        getAllItems().forEach(function(item) {
            delete item.time[activeShop];
            toStorage(item);
        });

        activeShop = null;
    });

    $("#buttonDeleteItem").on("click", function() {

        var seasonId = selectedItem.attr("seasonId");

        if(selectedItem.hasClass("suggestion")) {

            console.log("removing suggestion "+selectedItemName);

            if(seasonId) {
                selectedItemName = "_" + seasonId;
            }
            delete suggestions[selectedItemName];

            // Dont suggest this item again for a while
            var tmpItem = fromStorage(selectedItemName);
            tmpItem.suggestable = false;
            toStorage(tmpItem);

        } else {

            console.log("removing item "+selectedItemName);

            if(seasonId) {
                selectedItemName = "_" + seasonId;
            }

            // Delete this item from all collections (items and itemsSortedForShopping)
            delete items[selectedItemName];
            itemsSortedForShopping.forEach(function (item) {
                if(item.name === selectedItemName) {
                    var index = itemsSortedForShopping.indexOf(item);
                    itemsSortedForShopping.splice(index, 1);
                    // BAD: no break statement for 'foreach' => continue
                }
            });

            // Dont suggest this item again for a while
            var tmp = fromStorage(selectedItemName);
            tmp.suggestable = false;
            toStorage(tmp);

            updateHtmlList();
        }
    });

    $("#buttonFactoryReset").on("click", function() {
        localStorage.clear();
        items = {};
        shops = {};
        suggestions = {};
        saveState();
        init();
    });

    $("#finishShoppingButton").on("click", finishShoppingTour);
}
function registerSettingsCallbacks() {

    $("#languageSwitch").on("click", function(e) {

        switch(settings.language) {
            case "de":
                document.webL10n.setLanguage("en");
                settings.language = "en";
                break;
            case "en":
                document.webL10n.setLanguage("de");
                settings.language = "de";
                break;
            default :
                document.webL10n.setLanguage("en");
                settings.language = "en";
        }

        saveState();
        console.log("Language: "+settings.language);
        e.preventDefault();
    });

    $("#hemisphereSwitch").on("click", function(e) {

        switch(settings.southernHemisphere) {
            case true:
                settings.southernHemisphere = false;
                $(this).text(_("north"));
                break;
            case false:
                settings.southernHemisphere = true;
                $(this).text(_("south"));
                break;
            default :
                settings.southernHemisphere = false;
                $(this).text(_("north"));
        }

        saveState();
        console.log("Southern hemisphere: "+settings.southernHemisphere);
        e.preventDefault();
    });
}
function registerHardwareButtonCallbacks() {

    document.addEventListener("backbutton", function(){
        var previousPage = pageHistory.pop();

        if (previousPage === "#shopSelector" || previousPage === undefined) {
            window.close();
        } else {
            pageHistory.push(previousPage);
            switchToTab("BACK");
        }
    });
}

// Draw charts
function drawPieChart(placeholder, data, width, height) {

    // Set sizes
    $(placeholder).width(width);
    $(placeholder).height(height);

    // Label formatter
    function labelFormatter(label, series) {
        return "<div style='font-size:8pt; margin-left:-40px;  margin-top:-8pt; border-radius:4px; " +
            "text-align:center; padding:2px; color:white; background:black; opacity: 0.7'>" +
            label + "<br/>" +
            Math.round(series.percent) +
            "%</div>";
    }

    // Create the chart
    $.plot(placeholder, data, {
        series: {
            pie: {
                show: true,
                radius: 1,
                stroke: {
                    color: "white",
                    width: 2
                },
                label: {
                    show: true,
                    radius: 3/4,
                    threshold: 0.1,
                    formatter: labelFormatter
                }
            }
        },
        legend: {
            show: false
        }
    });
}
function drawBarChart(placeholder, data, width, height, color) {

    // Set sizes
    $(placeholder).width(width);
    $(placeholder).height(height);

    $.plot(placeholder, [ data ], {
        series: {
            bars: {
                show: true,
                barWidth: 0.8,
                fillColor: color,
                lineWidth: 0,
                align: "center"
            }
        },
        xaxis: {
            mode: "categories",
            tickLength: 0
        },
        yaxis: {
            tickDecimals: 0,
            tickLength: 0
        },
        grid: {
            labelMargin: 20,
            borderWidth: 0
        }
    });
}
function drawStoreVisitsChart() {

    var visits = [];
    for(var name in shops) {
        if(shops.hasOwnProperty(name)) {
            var tmp = JSON.parse(localStorage.getItem(name));
            visits.push([tmp.name, tmp.visits]);
        }
    }
    drawBarChart("#statisticsBarChart", visits, window.innerWidth*0.8, window.innerWidth*0.8, "#58b");
}
function drawTopProductsChart() {

    var topData = [];
    getTopProducts().forEach(function(item, index) {
        var name = isEven(index) ? item.name : "<br>"+item.name;  // try to prevent overlapping of labels
        topData.push([name, item.howmany]);
    });
    drawBarChart("#statisticsTopProductsBarChart", topData, window.innerWidth*0.8, window.innerWidth*0.8, "#5b8");
}
function drawProductCategoriesChart() {

    // Get the data
    var productsPerCategory = getProductsPerCategory();
    var data = [];
    for (var i = 0; i < 8; i++) {
        data[i] = {
            label: _(categories[i].label),
            color: categories[i].color,
            data: productsPerCategory[i]
        };
    }

    // Draw the pie chart
    drawPieChart("#statisticsPieChart", data, window.innerWidth*0.8, window.innerWidth*0.8);

    // Create the legend
    $("#statisticsPieChartLegendTotal").html("total: "+productsPerCategory[8]);
}
function hideNoStatsNotifierIfNecessary() {

    var listDataExists = false;
    for(var name in shops) {
        if(shops.hasOwnProperty(name)) {
            var shop = JSON.parse(localStorage.getItem(name));
            if(shop.visits > 0) {
                listDataExists = true;
            }
        }
    }
    if(listDataExists > 0) {
        $("#noStatsNotifier").hide();
        $("#statsContainer").show();
    } else {
        $("#noStatsNotifier").show();
        $("#statsContainer").hide();
    }
}
function drawAllCharts() {

    // Hide the "noStatsNotifier" if there is some statistics data
    hideNoStatsNotifierIfNecessary();

    // Create the product categories pie chart
    drawProductCategoriesChart();

    // Create the store visits bar chart
    drawStoreVisitsChart();

    // Create the top products bar chart
    drawTopProductsChart();
}

// Compute the chart data
function getProductsPerCategory() {

    // The last element contains the overall number of products
    var productsPerCategory = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    getAllItems().forEach(function(item) {
        productsPerCategory[item.category] += item.howmany;
        productsPerCategory[8] += item.howmany;
    });

    return productsPerCategory;
}
function getTopProducts() {

    var topProducts = getAllItems();

    // Sort the items in the topProducts list
    topProducts.sort(function(a, b) {
        return a.howmany < b.howmany;
    });
    var top6 = topProducts.slice(0, 6);

    console.log("Computed top products:");
    top6.forEach(function(element) {
        element.name = element.name.charAt(0) === "_" ? _(element.name.substr(1, element.name.length-1)) : element.name;
        console.log("    " + element.name + " : " + element.howmany);
    });

    return top6;
}

// Storage related methods
function getAllItems() {

    var foundItems = [];

    // Iterate over all items in localStorage and store them in foundItems
    for(var key in localStorage) {
        if(localStorage.hasOwnProperty(key)) {
            var tmp = fromStorage(key);
            if(tmp && tmp.type === "item") {
                foundItems.push(tmp);
            }
        }
    }

    return foundItems;
}
function fromStorage(name) {

    var item = JSON.parse(localStorage.getItem(name));

    if(item && item.type === "item") {
        return item;
    }

    return undefined;
}
function toStorage(item) {

    console.log("saving item " + item);

    if(item !== undefined && item.type === "item") {
        localStorage.setItem(item.name, JSON.stringify(item));
    } else {
        console.error("trying to save something as an item that is not an item");
    }
}
function saveState() {

    console.log("saving current state");

    localStorage.setItem("items", JSON.stringify(items));
    localStorage.setItem("suggestions", JSON.stringify(suggestions));
    localStorage.setItem("shops", JSON.stringify(shops));
    localStorage.setItem("settings", JSON.stringify(settings));

}
function loadState() {

    console.log("loading last state");

    items = JSON.parse(localStorage.getItem("items"));
    items = items === undefined || items === null  ? {} : items;

    suggestions = JSON.parse(localStorage.getItem("suggestions"));
    suggestions = suggestions === undefined || suggestions === null  ? {} : suggestions;

    shops = JSON.parse(localStorage.getItem("shops"));
    shops = shops === undefined || shops === null ? {} : shops;

    settings = JSON.parse(localStorage.getItem("settings"));
    settings = settings === undefined || settings === null ? new Settings("en") : settings;
}

// Actions to take when an item's status is set to done
function setDone(element) {

    // Update the item
    var seasonId = element.attr("seasonId");
    var itemName = seasonId ? "_"+seasonId : element.html();
    var item = fromStorage(itemName);
    item.done = true;
    item.howmany += 1;
    item.currentTime = Date.now() - tourStartTime;  // time after tour start
    toStorage(item);
    element.addClass("done");  // make the status visible

    console.log("setting item "+itemName+" to done");

    // Check if there are still items left in the list
    var itemsLeft = false;
    for(var name in items) {
        if(items.hasOwnProperty(name)) {
            var tmp = fromStorage(name);
            if(tmp === undefined || tmp === null) {
                delete items[name];
            } else if(tmp.done === false) {
                itemsLeft = true;
            }
        }
    }

    updateHtmlList();

    // Finish shopping if there are no more items left that are not marked as done
    if(!itemsLeft) {
        switchToTab("#finishShopping");
    }
}

// Finishing the shopping tour
function finishShoppingTour() {

    console.log("finished shopping at "+activeShop);

    // Change shop information (number of visits)
    var tmpShop = JSON.parse(localStorage.getItem(activeShop));
    tmpShop.visits += 1;
    localStorage.setItem(tmpShop.name, JSON.stringify(tmpShop));

    // Color the shopping button white again and restore the link
    var shoppingButton = $("#shoppingButton");
    shoppingButton.css("color", "white");
    shoppingButton.attr("href", "#startShopping");

    // Remove all items that have been set to done
    removeDoneItems(Date.now() - tourStartTime);

    // Set all items to suggestable again
    getAllItems().forEach(function(item) {
        if(item.suggestable === false) {
            item.suggestable = true;
            toStorage(item);
        }
    });

    // Reset variables
    activeShop = null;
    tourStartTime = null;
    itemsSortedForShopping = [];

    // Show the + button again
    $("#addItemButton").show();
}
function removeDoneItems(overallTime) {

    console.log("removing all items from the list that have been set to 'done'");

    var activeItems = {};
    for(var name in items) {
        if(items.hasOwnProperty(name)) {
            var item = fromStorage(name);
            if(item.done === false) {
                console.log("item "+item.name+" was not set to 'done'");
                activeItems[name] = true;
            } else {  // done

                console.log("setting item "+item.name+" to 'done'");

                // Update the time
                if(item.time[activeShop] === undefined) {
                    item.time[activeShop] = 0;
                }
                item.time[activeShop] = item.currentTime / overallTime;
                item.currentTime = 0;

                // Update last purchases
                if(item.lastPurchases === undefined) {
                    item.lastPurchases = [];
                }
                item.lastPurchases.push(Date.now());
                console.log("Added lastPurchase date");
                if(item.lastPurchases.length > 3) {  // oldest purchase
                    item.lastPurchases.shift();
                }

                // Reset done status
                item.done = false;

                console.info(item);
                toStorage(item);
            }
        }
    }
    items = activeItems;
}

// Show a toast with the given text
function toast(text, stayTimeSec) {

    var fade = 500;
    var stay = stayTimeSec === undefined ? 3000 : stayTimeSec * 1000;

    var msg = $("<p>"+text+"</p>");
    msg.addClass("toast");
    $("#toasts").append(msg);

    msg.fadeIn(fade).delay(stay).fadeOut(fade);
}

// Switch to the tab specified by the given id
function switchToTab(id) {

    var nextTab = id;

    function switchTab() {
        if(nextTab.contains("www")) {
            navigator.app.loadUrl(nextTab, { openExternal:true });
        } else {
            var t = $(".tabs " + nextTab);
            t.siblings().hide();
            t.fadeIn();
        }
    }

    if(nextTab === "BACK") {

        if(currentTab === "#itemList") {
            // close the app
            navigator.app.exitApp();
        }

        pageHistory.pop();  // remove the current page from history
        nextTab = pageHistory.pop();  // select the last page from history and delete it (added again below)
    }

    var lastTab = pageHistory.pop();
    pageHistory.push(lastTab);
    if(nextTab === lastTab && nextTab !== "#itemList") {
        return;
    }

    if(nextTab === "#startShopping") {
        // if there are no shops yet, redirect to the shops page
        var numberOfShops = 0;
        for(var name in shops) {
            if(shops.hasOwnProperty(name)) {
                numberOfShops++;
            }
        }
        if(numberOfShops === 0) {
            nextTab = "#shops";
        }
    }

    if(currentTab === "#changeShop") {
        activeShop = null;
    }

    // Special cases
    switch(nextTab) {
        case "#itemList":
            switchTab();
            pageHistory = [];  // reset the page history
            updateHtmlList();
            break;
        case "#addItem":
            switchTab();
            computeHtmlInputSuggestions();
            break;
        case "#menu":
            $("#menu").show();
            break;
        case "#statistics":
            switchTab();
            drawAllCharts();
            break;
        default:
            switchTab();
    }

    // don't store menu in history
    if(nextTab !== "#menu" && !nextTab.contains("www")) {
        pageHistory.push(nextTab);
    }

    currentTab = nextTab;
    console.log("Switched to tab "+currentTab + ", pageHistory="+pageHistory);
}
function resize() {
    console.log("resized window to width: "+window.innerWidth);
    $("#addItemButton").css("left", window.innerWidth/2 - 24 - 4);
    $("input").width(window.innerWidth - 48);
    $("a.button").width(window.innerWidth/2 - 26);
    $("a.button.single").width(window.innerWidth - 32);
}

// Sorting
function sortItemsByTime() {

    console.log("sorting items by time");

    // Put items into an array for sorting
    var itemsToSort = [];
    for(var name in items) {
        if(items.hasOwnProperty(name)) {

            var item = fromStorage(name);

            var i = 0;
            while(i<itemsToSort.length && item.time[activeShop] < itemsToSort[i].time[activeShop]) {
                i++;
            }
            itemsToSort.splice(i, 0, item);
        }
    }

    console.log("SORTED ITEMS:");
    console.log(itemsToSort);
    return itemsToSort;
}

// Compute suggestions
function computeSuggestions() {

    // Better clear old suggestions list here
    suggestions = {};

    getAllItems().forEach(function(item) {

        // Don't suggest items twice
        if(items[item.name] === undefined && suggestions[item.name] === undefined && item.suggestable) {

            if(item.name.charAt(0) === "_") {

                var month = (new Date()).getMonth() + 1;  // jan = 0, feb = 1, ...
                month = settings.southernHemisphere ? (month + 6) % 12 : month;

                // Is currently the season of this product
                var season = (item.seasonStart < item.seasonEnd && month >= item.seasonStart && month <= item.seasonEnd) ||
                    (item.seasonStart > item.seasonEnd && (month <= item.seasonStart || month >= item.seasonEnd));

                if(season && items[item.name] === undefined) {
                    suggestions[item.name] = true;
                }

            } else {

                // Get purchase times
                var first = item.lastPurchases[0];
                var second = item.lastPurchases[1];
                var third = item.lastPurchases[2];

                // Don't suggest items with less than 3 purchases
                if(first !== 0 && second !== 0 && third !== 0) {

                    // Compute times
                    var diffOne = second - first;
                    var diffTwo = third - second;
                    var averageTime = (diffOne + diffTwo) / 2;
                    var nextTime = third + averageTime;

                    // Decide wheter this item should be suggested or not
                    if(nextTime < Date.now()) {
                        suggestions[item.name] = true;
                    }
                }
            }
        }
    });
}
function computeHtmlInputSuggestions() {

    htmlInputSuggestions = [];

    getAllItems().forEach(function(item) {
        htmlInputSuggestions.push(item.name.charAt(0) === "_" ? _(item.name.substr(1, item.name.length-1)) : item.name);
    });

    // Item suggestions when typing
    suggestingElement = new Suggest.Local("newItemName", "suggest", htmlInputSuggestions, {dispMax: 5, highlight: true});

    console.log(htmlInputSuggestions);
}

// Update html
function updateHtmlList() {

    console.log("Updating html list");

    // Clear the previously displayed list
    var itemList = $("#items");
    itemList.empty();

    fillHtmlItemsList(itemList);
    fillHtmlSuggestionsList(itemList);

    console.log("SUGGESTIONS:");
    console.log(suggestions);
    console.log("ITEMS:");
    console.log(items);

    // Register callbacks for the items
    registerItemCallbacks();

    // Save the current state
    saveState();
}
function fillHtmlItemsList(itemList) {

    var item;
    var style;
    var htmlItem;
    var seasonId;

    // Load all items
    console.log("loading items for html");
    if(activeShop === undefined || activeShop === null) {

        // No shopping (no sorting)

        for(var name in items) {
            if(items.hasOwnProperty(name)) {

                item = fromStorage(name);
                seasonId = "";

                // Season item? Translate!
                if(name.charAt(0) === "_") {
                    seasonId = item.name.substr(1, item.name.length);
                    item.name = _(seasonId);
                }

                if(item !== undefined) {
                    htmlItem = $("<p>"+item.name+"</p>");
                    if(!item.done) {
                        if(item.version) {
                            htmlItem.css("background-color", categories[item.category].color);
                        } else {
                            htmlItem.css("background-color", "black");
                            htmlItem.css("color", "white");
                        }
                    }
                    if(seasonId !== "") {
                        htmlItem.attr("seasonId", seasonId);
                    }
                    itemList.prepend(htmlItem);
                }
            }
        }
    } else {

        // Shopping

        itemsSortedForShopping.forEach(function(i) {

            var item = fromStorage(i.name);
            seasonId = "";

            // Season item? Translate!
            if(item.name.charAt(0) === "_") {
                seasonId = item.name.substr(1, item.name.length);
                item.name = _(seasonId);
            }

            if(item !== undefined) {
                htmlItem = $("<p>"+item.name+"</p>");
                if(item.done) {
                    htmlItem.css("background-color", "white");
                } else {
                    htmlItem.css("background-color", categories[item.category].color);
                }
                if(seasonId !== "") {
                    htmlItem.attr("seasonId", seasonId);
                }
                itemList.prepend(htmlItem);
            }
        });
    }
}
function fillHtmlSuggestionsList(itemList) {

    var item;
    var style;
    var htmlItem;
    var seasonId;

    // Load suggestions if not in shopping mode
    console.log("loading suggestions for html");
    if(activeShop === undefined || activeShop === null) {
        computeSuggestions();
        for(var name in suggestions) {
            if(suggestions.hasOwnProperty(name)) {

                item = fromStorage(name);
                seasonId = "";

                // Season item? Translate!
                if(name.charAt(0) === "_") {
                    seasonId = item.name.substr(1, item.name.length);
                    item.name = _(seasonId);
                }

                if(item !== undefined) {
                    htmlItem = $("<p>" + item.name + "</p>");
                    htmlItem.css("border-color", categories[item.category].color);
                    htmlItem.addClass("suggestion");
                    if(seasonId !== "") {
                        htmlItem.attr("seasonId", seasonId);
                    }
                    itemList.prepend(htmlItem);
                }
            }
        }
    }
}
function updateHtmlShopSelector() {

    // Rebuild the shop selector
    var shopSelectorBody = $("#shopSelectorBody");
    var startShoppingShopSelector = $("#startShoppingShopSelector");
    shopSelectorBody.empty();
    startShoppingShopSelector.empty();

    var numberOfShops = 0;
    for(var name in shops) {
        if(shops.hasOwnProperty(name)) {
            numberOfShops++;
            shopSelectorBody.prepend($("<p><a class='shopEntry'>"+name+"</a></p>"));
            startShoppingShopSelector.prepend($("<p><a class='shopEntry'>"+name+"</a></p>"));
        }
    }
    $(".shopEntry").width(window.innerWidth - 48);

    registerShopSelectorCallbacks();

    // Notify the user if there are no list configured yet
    if(numberOfShops === 0) {
        $("#noShopsNotifier").show();
    } else {
        $("#noShopsNotifier").hide();
    }

    console.log("Updated shop selector");
}
function createCategoriesPageFor(addOrChange) {

    var table = $("#"+addOrChange+"CategoriesTable");

    var rows = 4;
    var columns = 4;

    for(var row=0; row<rows; row++) {
        var tr = $("<tr>");
        for(var column=0; column<columns; column++) {
            var id = row*rows+column;
            var td = $("<td>");
            td.attr("id", "cat-"+id+"-"+addOrChange+"");
            var img = $("<img>");
            img.attr("src", categories[id].icon);
            img.attr("alt", categories[id].label);
            img.text(categories[id].label);
            td.css("background-color", categories[id].color);
            td.append(img);
            tr.append(td);
        }
        table.append(tr);
    }
}

// Utility functions
function isEven(n) {
    return Math.abs(n) % 2 === 0;
}
