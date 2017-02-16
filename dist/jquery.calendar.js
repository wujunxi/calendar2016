/**
 * @author wujx
 * @date 2016-02-16
 * @version 1.0.5
 * https://github.com/wujunxi/calendar2016
 */
(function(factory) {
    if (typeof define === "function" && define.amd) {
        // AMD模式
        define(["jquery"], factory);
    } else {
        // 全局模式
        factory(jQuery);
    }
}(function ($) {
    var NAMESPACE = "calendar",
        LANG = "zh-cn",
        EN_WEEK = {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun"},
        CN_WEEK = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "日"},
        EN_UNIT = {year: "Year", month: "Month", day: "Day"},
        CN_UNIT = {year: "年", month: "月", day: "日"},
        WEEK = (LANG == "zh-cn" ? CN_WEEK : EN_WEEK),
        UNIT = (LANG == "zh-cn" ? CN_UNIT : EN_UNIT);

    var $panel, $header, $year, $month, $dayList, $monthList, $yearList, $left, $right, $cElem;
    var cSettings, // 当前配置
        nYear, nMonth, nDate, // 选中的日期
        cYear, cMonth, cDate, // 当前展示的日期
        cType, // 当前菜单类型
        cMode, // 时间范围模式
        iYear, // 年份页标
        fromStr, // 可选起始时间
        toStr, // 可选终止时间
        isShow = false; // 显示状态

    $.fn.calendar = function () {
        var method = arguments[0];
        if (methods[method]) {
            method = methods[method];
            arguments = Array.prototype.slice.call(arguments, 1);
        } else if (typeof(method) == 'object' || !method) {
            method = methods.init;
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.calendar');
            return this;
        }
        return method.apply(this, arguments);
    };

    var defaults = $.fn.calendar.defaults = {
        from: "0000-00-00", // 可选起始时间
        to: "9999-00-00", // 可选终止时间
        def: "", // 默认时间
        format: "yyyy-mm-dd", // 日期格式
        start: null, // 关联起始时间
        end: null, // 关联终止时间
        onSelect: $.noop, // 选中事件
        afterSelect: $.noop, // 选中后事件
        onShow: $.noop, // 显示事件
        onHide: $.noop // 隐藏事件
    };

    var methods = {
        init: function (options) {
            return this.each(function () {
                var $this = $(this);
                var settings = $this.data(NAMESPACE);
                if (typeof(settings) == 'undefined') {
                    settings = $.extend({}, $.fn.calendar.defaults, options);
                    $this.data(NAMESPACE, settings);
                } else {
                    settings = $.extend({}, settings, options);
                }
                if (!$panel) {
                    $panel = createPanel();
                    $("body").append($panel);
                    $panel = $(".cal-panel");
                    $header = $("._header", $panel);
                    $year = $("._year", $header);
                    $month = $("._month", $header);
                    $dayList = $("._day_list", $panel);
                    $monthList = $("._month_list", $panel);
                    $yearList = $("._year_list", $panel);
                    $left = $("._left", $panel);
                    $right = $("._right", $panel);
                    bindEvent();
                }
                bindElem($this, settings);
            });
        },
        destroy: function (options) {
            return $(this).each(function () {
                var $this = $(this);
                $this.removeData(NAMESPACE);
            });
        },
        val: function (v) {
            if(v){
                setDate(v);
                var temp = getDate(defaults.format);
                this.val(temp).attr("data-date", temp);
            }else{
                return this.attr("data-date");
            }
        }
    };

    /**
     * 事件绑定
     */
    function bindEvent() {
        $year.on("click", function () {
            switchPanel("year");
        });
        $month.on("click", function () {
            switchPanel("month");
        });
        // 年份选择
        $yearList.on("click", "._year", function () {
            var $this = $(this),
                year = $this.text();
            if (!$this.hasClass("active")) {
                return;
            }
            //cYear = parseInt(year.substr(0, year.length - 1));
            cYear = year;
            refreshAll();
            switchPanel("day");
        });
        // 月份选择
        $monthList.on("click", "._month", function () {
            var $this = $(this), month = $this.text();
            if (!$this.hasClass("active")) {
                return;
            }
            // 去单位
            cMonth = parseInt(month.substr(0, month.length - 1));
            refreshAll();
            switchPanel("day");
        });
        // 日期选择
        $dayList.on("click", "._day", function () {
            var $this = $(this),
                date = $this.text(),
                val,
                temp,
                ret;
            if (!$this.hasClass("active")) {
                return;
            }
            nDate = parseInt(date);
            nYear = cYear;
            nMonth = cMonth;
            temp = getDate(defaults.format);
            val = getDate(cSettings.format);
            // 触发选中事件
            if(cSettings.onSelect){
                ret = cSettings.onSelect(val);
                if(ret === false) return;
            }
            $cElem.val(val).attr("data-date", temp);
            // 选中开始时间后清空终止时间
            if(cMode == "start"){
                cSettings.end.val("").attr("data-date","");
            }
            hide();
            refreshAll();
            // 触发选中后事件
            if(cSettings.afterSelect){
                cSettings.afterSelect(val);
            }
        });
        // 向前翻页
        $left.on("click", prevPage);
        // 向后翻页
        $right.on("click", nextPage);
        // 点击非控件区域关闭
        $(document).on("click", function (e) {
            //console.log(e);
            if (isShow && $panel) {
                if (!$cElem.is(e.target) && !$.contains($panel[0], e.target) && !$(e.target).hasClass("cal-icon")) {
                    hide();
                }
            }
        });
    }

    /**
     * 下一页
     */
    function nextPage(){
        if ($right.hasClass("off")) {
            return;
        }
        if (cType == "year") {
            iYear += 21;
            refreshYearList();
        } else if (cType == "day") {
            if (cMonth == 12) {
                cMonth = 1;
                cYear++;
            } else {
                cMonth++;
            }
            refreshDayList();
            refreshHeader();
        }
    }

    /**
     * 上一页
     */
    function prevPage(){
        if ($left.hasClass("off")) {
            return;
        }
        if (cType == "year") {
            iYear -= 21;
            refreshYearList();
        } else if (cType == "day") {
            if (cMonth == 1) {
                cMonth = 12;
                cYear--;
            } else {
                cMonth--;
            }
            refreshDayList();
            refreshHeader();
        }
    }

    /**
     * 隐藏
     */
    function hide() {
        if(cSettings.onHide){
            cSettings.onHide();
        }
        $panel.hide();
        isShow = false;
    }

    /**
     * 显示
     * @param $elem
     */
    function show($elem) {
        var settings = $elem.data(NAMESPACE),
            date = $elem.attr("data-date") || settings.def,
            temp, from, to;
        // 保存当前操作对象及配置
        $cElem = $elem;
        cSettings = settings;
        // 设置日期
        setDate(date);
        from = settings.from;
        to = settings.to;
        cMode = "single";
        // 判断是否有关联起始日期和终止日期
        if (settings.start) {
            temp = settings.start.attr("data-date");
            from = temp ? temp : settings.from;
            cMode = "end";
        } else if (settings.end) {
            // 选择起始日期的时候不限制终止日期
            //temp = settings.end.attr("data-date");
            //to = temp ? temp : settings.to;
            cMode = "start";
        }
        // 设置可选开始日期和结束日期
        setFrom(from);
        setTo(to);
        if (fromStr > toStr) {
            throw "[calendar.error]from-date must small than to-date";
        }
        // 切换到日期选择页
        switchPanel("day");
        refreshAll();
        if(cSettings.onShow){
            cSettings.onShow();
        }
        //定位
        var pos = $elem.offset(),
            h = $elem.outerHeight();
        $panel.css({top: pos.top + h + 1 + "px", left: pos.left + "px"}).show();
        isShow = true;
    }

    /**
     * 格局模式字符串格式化日期
     * @param pattern
     * @param year
     * @param month
     * @param date
     * @returns {XML|string}
     */
    function formatDate(pattern, year, month, date) {
        month = "" + month;
        date = "" + date;
        if(month.length < 2){
            month = "0" + month;
        }
        if(date.length < 2){
            date = "0" + date;
        }
        return pattern.replace('yyyy', year).replace('mm', month).replace('dd', date);
    }

    /**
     * 获得选中日期
     * @param format
     * @returns {XML|string}
     */
    function getDate(format) {
        return formatDate(format, nYear, nMonth, nDate);
    }

    /**
     * 设置选中日期
     * @param date
     */
    function setDate(date) {
        var dateObj;
        if(date == ""){
            dateObj = dateExpress("n");
            iYear = cYear = dateObj.y;
            cMonth = dateObj.m;
            cDate = dateObj.d;
            nYear = nMonth = nDate = null;
        }else{
            dateObj = dateExpress(date);
            iYear = cYear = nYear = dateObj.y;
            cMonth = nMonth = dateObj.m;
            cDate = nDate = dateObj.d;
        }
        //console.log(temp,nYear,nMonth,nDate);
    }

    /**
     * 设置可选起始日期
     * @param date
     */
    function setFrom(date) {
        var temp, i,len,dateObj;
        // 如果是数组，取最大值作为起始日期
        if($.isArray(date)){
            for(i = 0,len = date.length; i < len; i++){
                temp = dateExpress(date[i]);
                if(i == 0){
                    dateObj = temp
                }else if(dateObj.times < temp.times){
                    dateObj = temp;
                }
            }
        }else{
            dateObj = dateExpress(date);
        }
        fromStr = formatDate(defaults.format,dateObj.y,dateObj.m,dateObj.d);
    }

    /**
     * 设置可选终止日期
     * @param date
     */
    function setTo(date) {
        var temp, i,len,dateObj;
        // 如果是数组，取最小值作为终止日期
        if($.isArray(date)){
            for(i = 0,len = date.length; i < len; i++){
                temp = dateExpress(date[i]);
                if(i == 0){
                    dateObj = temp
                }else if(dateObj.times > temp.times){
                    dateObj = temp;
                }
            }
        }else{
            dateObj = dateExpress(date);
        }
        toStr = formatDate(defaults.format,dateObj.y,dateObj.m,dateObj.d);
    }

    /**
     * 日期表达式转义
     * @param expr n-当前日期 f-起始日期 m-月份 y-年 w-星期 d-天
     * @returns {{y: number, m: number, d: number}}
     */
    function dateExpress(expr) {
        var now = new Date(),
            newDate,
            array = [],
            i,len,item,temp,symbol,
            times,
            ds = 3600 * 1000 * 24,
            ws = ds * 7,
            y = 0,
            m = 0,
            d = 0;
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(expr)) { // 具体日期
            temp = expr.split("-");
            y = parseInt(temp[0],10);
            m = parseInt(temp[1],10);
            d = parseInt(temp[2],10);
        } else if (/^([\+\-]?((\d+[ymwd])|(\d+)|[ymwdnf]))+$/.test(expr)) { // 日期表达式
            // 判断表达式基础日期是起始日期还是当前日期
            if(expr.indexOf("f") > -1){
                times = (new Date(fromStr)).getTime();
            }else{
                times = now.getTime();
            }
            // 拆解表达式并计算
            array = expr.match(/[\+\-]?((\d+[ymwd])|(\d+)|[ymwd])|[nf]/g);
            for(i = 0,len = array.length; i < len; i++){
                item = array[i];
                if(/^[\+\-]?\d+$/.test(item)){ // 纯数字为天数
                    temp = parseInt(item);
                    times += temp * ds;
                }else if(item != "n" && item != "f"){
                    symbol = item.substr(item.length - 1);
                    temp = item.substring(0,item.indexOf(symbol));
                    temp = temp == "-" ? "-1" : temp;
                    temp = temp == "+" ? "1" :temp;
                    temp = parseInt(temp);
                    if(symbol == "d"){
                        times += temp * ds;
                    }else if(symbol == "w"){
                        times += temp * ws;
                    }else if(symbol == "m"){
                        newDate = new Date(times);
                        y = newDate.getFullYear();
                        m = newDate.getMonth();
                        d = newDate.getDate();
                        if(temp > 0){
                            y += Math.floor(temp/12);
                        }else{
                            y += Math.ceil(temp/12);
                        }
                        m += temp%12;
                        times = (new Date(y,m,d)).getTime();
                    }else if(symbol == "y"){
                        newDate = new Date(times);
                        y = newDate.getFullYear();
                        m = newDate.getMonth();
                        d = newDate.getDate();
                        y += temp;
                        times = (new Date(y,m,d)).getTime();
                    }
                }
            }
            newDate = new Date(times);
            y = newDate.getFullYear();
            m = newDate.getMonth() + 1;
            d = newDate.getDate();
        } else {
            throw "[calendar.error]date express is error:"+expr;
        }
        return {y: y, m: m, d: d,times:times};
    }

    /**
     * 切换菜单
     * @param type
     */
    function switchPanel(type) {
        cType = type;
        $dayList.hide();
        $yearList.hide();
        $monthList.hide();
        $left.removeClass("off");
        $right.removeClass("off");
        if (type == "year") {
            $yearList.show();
        } else if (type == "month") {
            $monthList.show();
            $left.addClass("off");
            $right.addClass("off");
        } else if (type == "day") {
            $dayList.show();
        }
    }

    /**
     * 更新全部
     */
    function refreshAll() {
        refreshHeader();
        refreshYearList();
        refreshMonthList();
        refreshDayList();
    }

    /**
     * 更新头部
     */
    function refreshHeader() {
        var temp;
        $year.text(cYear);
        // 补零
        if(cMonth < 10){
            temp = "0" + cMonth;
        }else{
            temp = cMonth
        }
        $month.text(temp);
    }

    /**
     * 更新日期列表
     */
    function refreshDayList() {
        var len = (new Date(cYear, cMonth, 0)).getDate(), // 取下个月的第0天日期，即本月的天数
            first = (new Date(cYear, cMonth - 1, 1)).getDay(), // 取本月第一天所在星期的星期几，作为显示天数的起点
            last = first + len,// 显示天数的终点
            date = 1;
        //console.log(cYear,cMonth,cDate);
        //console.log(len,first,last);
        $("._day", $dayList).each(function (i, e) {
            var $e = $(e),
                dateStr = formatDate(defaults.format, cYear, cMonth, date),
                className = "_day cal-day",
                text = "";
            if (i >= first && i < last) {
                text = date;
                //console.log(fromStr,toStr,dateStr);
                // 在可选范围内
                if (dateStr >= fromStr && dateStr < toStr) { // 包头不包尾
                    className += " active";
                    if (cMode == "start" && dateStr == toStr) {
                        //选择其实日期的时候不显示终止日期
                        //className += " on end";
                    } else if (cMode == "end" && dateStr == fromStr) {
                        className += " on start";
                    }
                    if (date == nDate && nYear == cYear && nMonth == cMonth) {
                        className += " on";
                        if (cMode == "start") {
                            className += " start";
                        } else if (cMode == "end") {
                            className += " end";
                        }
                    }
                }
                date++;
            }
            $e.text(text).attr("class", className);
        });
    }

    /**
     * 更新月份列表
     */
    function refreshMonthList() {
        $(".on", $monthList).removeClass("on");
        $("._month:eq(" + (cMonth - 1) + ")", $monthList).addClass("on");
    }

    /**
     * 更新年份列表
     */
    function refreshYearList() {
        var index = iYear - 10;
        $(".on", $yearList).removeClass("on");
        $("._year", $yearList).each(function (i, e) {
            var $e = $(e);
            if (index == cYear) {
                $e.addClass("on");
            }
            $e.text(index++);
        });
    }

    /**
     * 创建菜单
     * @returns {*|HTMLElement}
     */
    function createPanel() {
        var i, j, m, n, k, htmlStr,
            week = [7,1,2,3,4,5,6];
        htmlStr = '<div class="cal-panel" style="display: none;">'
            + '<div class="cal-left _left"></div><div class="cal-right _right"></div>'
            + '<div class="cal-header _header"><span class="_year cal-year"></span>' + UNIT["year"] + '<span class="_month cal-month"></span>' + UNIT["month"] + '</div>';
        // 日期列表
        htmlStr += '<div class="cal-main _day_list">';
        htmlStr += '<div class="cal-week _week">';
        // 每周从周日开始
        for (i = 0; i < 7; i++) {
            htmlStr += '<span class="cal-weekday">' + WEEK[week[i]] + '</span>';
        }
        htmlStr += '</div>';
        for (i = 0, m = 6; i < m; i++) {
            htmlStr += '<div class="cal-row">';
            for (j = 0, n = 7; j < n; j++) {
                htmlStr += '<span class="cal-day _day"></span>';
            }
            htmlStr += '</div>';
        }
        htmlStr += '</div>';
        // 年列表
        htmlStr += '<div class="cal-main _year_list" style="display:none;">';
        for (i = 0, m = 7; i < m; i++) {
            htmlStr += '<div class="cal-row">';
            for (j = 0, n = 3; j < n; j++) {
                htmlStr += '<span class="cal-cell active _year"></span>';
            }
            htmlStr += '</div>';
        }
        htmlStr += '</div>';
        // 月份列表
        htmlStr += '<div class="cal-main _month_list" style="display:none;">';
        for (i = 0, m = 4; i < m; i++) {
            htmlStr += '<div class="cal-row">';
            for (j = 0, n = 3; j < n; j++) {
                htmlStr += '<span class="cal-cell active _month">' + (3 * i + j + 1) + UNIT["month"] + '</span>';
            }
            htmlStr += '</div>';
        }
        htmlStr += '</div>';
        htmlStr += '</div>';
        return $(htmlStr);
    }

    /**
     * 绑定到节点
     * @param $elem
     * @param options
     */
    function bindElem($elem, options) {
        var $icon = $('<span class="cal-icon"></span>'),
            temp, val;
        $icon.click(function () {
            show($elem);
        });
        $elem.focus(function(){
            show($elem);
        }).on("keyup",function(e){
            if(e.keyCode == "27"){
                hide();
            }
        });
        $elem.after($icon);
        if(options.def != ""){
            setDate(options.def);
            temp = getDate(defaults.format);
            val = getDate(options.format);
            $elem.val(val).attr("data-date", temp);
        }
    }
}));