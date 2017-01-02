class Score
  constructor: (date, summary, notes) ->
    @date = date
    @summary = summary
    @notes = notes

  dateId: () ->
    @date.format("{yyyy}-{MM}-{dd}")

  dateStr: () ->
    @date.format("{d} {Mon} {yyyy}")

  weekday: () ->
    @date.format("{Weekday}")

  styleClass: () ->
    return 'val0' unless @summary?
    'val'+@summary

class FaveDayApp
  constructor: ->
    @tmplScores = Hogan.compile($('#tmpl-scores').html())

    $('#search input').keyup(@showSearch)

    @setupScores()

  setupScores: ->
    if demoNotes?
      @setupDemoUser()
    else
      @setupLocalFolder()

  setupLocalFolder: ->
    @all = []

    unless window.localStorage.folder?
      dialog = require('remote').dialog
      folder = dialog.showOpenDialog({ properties: [ 'openDirectory' ]}).first()
      window.localStorage.folder = folder

    else
      folder = window.localStorage.folder

    fs = require('fs')
    files = fs.readdirSync(folder)
    re = /([\d-]+),(\d),(.*)/g

    console.info("reading folder #{folder}")

    for file in files
      txt = fs.readFileSync("#{folder}/#{file}")
      loop
        matches = re.exec(txt)
        break unless matches?

        @all.push(new Score(new Date(matches[1]), parseInt(matches[2]), matches[3]))

    console.log("loaded #{@all.length} entries")
    @all = @all.sortBy('date', true)

    @onScoreLoaded()

  setupDropbox: ->
    @db = new Dropbox.Client({
      key: "DYYDuQIY88A=|hZcFHupIV1V83K7o3M0VHrVmeZK70RZnb0PCIVz7ag==",
      sandbox: true
    })

    @db.authDriver(new Dropbox.Drivers.Redirect(rememberUser: true))
    # as redirect param

    @db.authenticate((error, client) =>
      return showError(error) if error

      @db.getUserInfo((error, userInfo) =>
        return showError(error) if error
        $('#userName').html(userInfo.name)
        $('#loading').html('Loading Scores from DropBox. Please wait..')

        @db.readFile("scores-db.txt", (error, rawData) =>
          return showError(error) if error

          # load data from dropbox text file
          @all = rawData.split('\n').filter((l) -> l.length > 10).map((l) ->
            summary = parseInt(l[11])
            summary = null unless summary?

            new Score(Date.create(l[0...10]), summary, l[13..])
          )

          @onScoreLoaded()
        )
      )
    )

  setupDemoUser: () ->
    $('#userName').html('Demo User')

    @all = for i in [0..800]
      score = new Score(
        Date.create().addDays(-i),
        Math.floor((Math.random()*5)+1),
        demoNotes.sample()
      )

    @onScoreLoaded()

  onScoreLoaded: () ->
    @years = [@all.last().date.getFullYear()..@all.first().date.getFullYear()]

    $('#topArea').show()
    $('#loading').hide()

    # $('#datePicker').datepicker()

    @showDashboard()

  showError: ()  ->
    @render('#tmpl-landing', '#content',
      {error: 'Could not connect :-('}, {})

  render: (templateId, viewId, atts, partials) ->
    view = Hogan.compile($(templateId).html())
    $(viewId).html(view.render(atts, partials))

  toggleScoreDialogue: () ->
    if $('#addScore').is(':visible')
      $('#addScore').hide()
      $('#addScoreBtn .btn').removeClass('active')
    else
      $('#datePicker').text(Date.create().format("{dd}-{mm}-{yyyy}"))
      $('#addScoreBtn .btn').addClass('active')
      $('#addScore').show()

  showDashboard: () ->
    recent = @all[...3]
    bestScores = @all.filter((s) -> s.summary == 5).sample()

    today = Date.create()
    toDate = today.getDate()
    toMonth = today.getMonth()

    todayScores = @all.filter((s) ->
      s.date.getDate() is toDate and s.date.getMonth() is toMonth
    )

    @render('#tmpl-dashboard', '#content', {
      recentScores: @tmplScores.render({scores: recent}),
      bestScores: @tmplScores.render({scores: bestScores}),
      todayScores: @tmplScores.render({scores: todayScores}),
      years: @years.map((y) -> {year: y})
    }, {
      yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
    })

  showMonth: (id) ->
    date = Date.create(id)

    title = date.format('{Month} {yyyy}')
    monthScores = @all.filter((s) -> s.date.getMonth() is date.getMonth() and
      s.date.getYear() is date.getYear())

    @render('#tmpl-month', '#content', {
      title: title,
      scores: if monthScores.isEmpty() then [] else @tmplScores.render({scores: monthScores}),
      years: @years.map((y) -> {year: y})
    }, {
      yearsBar: Hogan.compile($('#tmpl-years-bar').html())
    })

  updateRandomInspiration: ->
    bestScores = @all.filter((s) -> s.summary == 5).sample()

    $('#bestScores').html(
      @tmplScores.render({scores: bestScores}),
    )

  showYears: ->
    lerp = (t, a, b, i) ->
      Math.floor(t*parseInt(a[i], 16)+(1-t)*parseInt(b[i], 16))

    interpCol = (t, col1, col2) ->
      c1 = [col1[1..2], col1[3..4], col1[5..6]]
      c2 = [col2[1..2], col2[3..4], col2[5..6]]

      "rgb(#{lerp(t, c1, c2, 0)}, #{lerp(t, c1, c2, 1)}, #{lerp(t, c1, c2, 2)})"

    getColorForVal = (val) ->
      return '#33AA66' if val >= 5.00
      return interpCol(val-4, '#9AD600', '#33AA66') if val >= 4.00
      return interpCol(val-3, '#FFAD26', '#9AD600') if val >= 3.00
      return interpCol(val-2, '#FFB399', '#FFAD26') if val >= 2.00
      return interpCol(val-1, '#FF794D', '#FFB399') if val >= 1.00

    getYearMonths = (yearScores) ->
      Object.values(yearScores.groupBy((s) ->
        s.date.getMonth()
      )).map((scores) ->
        {
          val: scores.average((s) -> s.summary),
          dateId: scores.first().date.format("{yyyy}-{MM}")
        }
      )

    getYearInspiration = (yearScores) =>
      inspiration = yearScores.filter((s) ->
        s.summary >= 4
      ).sample(2).sortBy(((s) ->
        s.date), true
      )

      if inspiration.isEmpty() then null else @tmplScores.render({scores: inspiration})

    byYear = @all.groupBy((s) -> s.date.getFullYear())
    yearsScores = for year, yearScores of byYear
      year: year,
      totalAvg: yearScores.average((s) -> s.summary).format(2),
      totalCount: yearScores.length,
      months: getYearMonths(yearScores)
      inspiration: getYearInspiration(yearScores)

    maxAvg = yearsScores.map(
      (s) -> s.months.max((m) -> m.val).first().val
    ).max().first()

    minAvg = yearsScores.map(
      (s) -> s.months.min((m) -> m.val).first().val
    ).min().first()

    # calculate colors for each month in second step
    for yearScore in yearsScores
      for month in yearScore.months
        month.col = getColorForVal(1+4*(month.val-minAvg)/(maxAvg-minAvg))
        month.val = month.val.format(2)

    inspiration = for year, yearScores of byYear
      year: year
      insp: getYearInspiration(yearScores)

    @render('#tmpl-years', '#content', {
      scores: yearsScores.reverse(),
      inspiration: inspiration.filter((i) -> i.insp? ).reverse(),
      years: @years.map((y) -> {year: y})
    }, {
      yearsBar: Hogan.compile($('#tmpl-years-bar').html())
    })

  showYear: (id) ->
    countVal = (scores, val) ->
      ct = scores.count((s) -> s.summary is val)

      {
        val: val,
        full: i for i in [0...Math.floor(ct / 5)],
        part: i for i in [0...(ct % 5)]
      }

    id = parseInt(id)

    yearScores = @all.filter((s) -> s.date.getFullYear() is id)
    byMonth = yearScores.groupBy((s) -> s.date.getMonth())

    months = for month, scores of byMonth
      date: Date.create("#{id}-#{parseInt(month)+1}").format('{Mon} {yyyy}')
      dateId: "#{id}-#{parseInt(month)+1}-1"
      avg: scores.average((s) -> s.summary).format(2)
      counts: countVal(scores, i) for i in [5..1]

    months.reverse()

    randomScores = yearScores.filter((s) -> s.summary >= 3).sample(5)
    bestScores = yearScores.filter((s) -> s.summary == 5).sample(2).sortBy(((s) -> s.date), true)

    @render('#tmpl-year', '#content', {
      year: id,
      scores: if randomScores.isEmpty() then [] else @tmplScores.render({scores: randomScores}),
      inspiration: if bestScores.isEmpty() then [] else @tmplScores.render({scores: bestScores}),
      months: months,
      years: @years.map((y) -> {year: y})
    }, {
      yearsBar: Hogan.compile($('#tmpl-years-bar').html())
    })

  showSearch: () =>
    needles = $('#search input')[0].value
    return @showDashboard() if needles.length < 1

    foundScores = @all
    keywords = []

    for needle in needles.split(' ')
      continue if needle.length < 1

      needle = needle.toLowerCase()

      # score criterium
      if needle[0] in ['>', '<', '='] and needle.length is 2
        score = parseInt(needle[1])

        range = if needle[0] is '>'
            [score..5]
          else if needle[0] is '<'
            [0..score]
          else
            [score]

        foundScores = foundScores.filter((s) -> s.summary in range)

      else if needle.last() is '.' and parseInt(needle)
        needleDate = parseInt(needle)
        foundScores = foundScores.filter((s) -> s.date.getDate() is needleDate)

      # arbitrary date criterium
      else
        date = Date.create(needle)
        if date.isValid()
          foundScores = foundScores.filter((s) -> s.date.is(needle))

        # text criterium
        else if needle.length > 2
          foundScores = foundScores.filter((s) -> s.notes.toLowerCase().indexOf(needle) > -1)
          keywords.push(needle)

    @render('#tmpl-search', '#content', {
      count: foundScores.length,
      average: foundScores.average((s) -> s.summary).format(2)
      scores: @tmplScores.render({scores: foundScores}),
      years: @years.map((y) -> {year: y})
    }, {
      yearsBar: Hogan.compile($('#tmpl-years-bar').html())
    })

    for elem in $('.notes')
      for keyword in keywords
        regex = new RegExp("(#{keyword})", 'ig')
        $(elem).html(elem.textContent.replace(regex, "<strong>$1</strong>"))


    #@showPlot()

  # showPlot: () ->
  #   <% data_vals = plot_data_months @avg_months %>

  #   var plotData = [{
  #     data:[<%= data_vals.join(',') %>],
  #     <%= plot_style data_vals %>
  #   }];

  #   var plotOptions = {
  #     grid: {
  #       borderWidth: 0,
  #       markings: [<%= plot_markings_months @months %>]
  #     },
  #     xaxis: {ticks: [<%= plotXAxisMonths @months %>]},
  #     yaxis: {minTickSize: 0.5, tickDecimals: 1}
  #   };

  #   $.plot($("#plot"), plotData, plotOptions);

window.onload = ->
  window.app = new FaveDayApp

window.onConnect = ->
  window.app.setupDropbox()

window.onShowMonth = (id) ->
  window.app.showMonth(id)

window.onShowYear = (id) ->
  window.app.showYear(id)

window.onShowYears = ->
  window.app.showYears()

window.onShowDashboard = ->
  window.app.showDashboard()

window.onUpdateRandomInspiration = ->
  window.app.updateRandomInspiration()

window.onToggleScoreDialogue = ->
  window.app.toggleScoreDialogue()

window.onCancelScoreDialogue = ->
  window.app.cancelScoreDialogue()

window.onShowSearch = ->
  window.app.showSearch()
