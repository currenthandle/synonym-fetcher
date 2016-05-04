var fs = require('fs')
var request = require('request')
var express = require('express');
var bodyParser = require('body-parser');
var app     = express();
var cheerio = require('cheerio')
var hyperstream = require('hyperstream')
var h = require('virtual-dom/h')
var createElement = require('virtual-dom/create-element')


app.use(bodyParser.urlencoded({ extended: true })); 

//app.use(express.bodyParser());

app.post('/search', function(req, res) {
	var word = 'present'
	word = req.body.word
	request("http://thesaurus.altervista.org/service.php?word="+word+"&language=en_US&output=json&key=SS3IcLAnzS2CcXXDH6UC", function (err, resp, content){
		var result = JSON.parse(content)
		var synonyms = result.response.reduce(function(prev, current){
			return prev.concat(current.list.synonyms.split('|'))
		}, [])
		.filter(function(element){
			return element.indexOf('(') === -1
		})
		//console.log('S',synonyms)
		var queries = [word].concat(synonyms)
		var resp = crawl(queries)


		var virtualNode = h('div', resp)
		var html = createElement(virtualNode).toString()
        fs.createReadStream('public/index.html')
            .pipe(hyperstream({
                '#content': html
            }))
            .pipe(res)	
		})  
		//res.send('You sent the name "' + req.body.word+ '".');
});

app.use(express.static(__dirname + '/public'))


function crawl(queries) {
	//console.log('in crawl')
	var limit = 140
	var query 
	var pos = 0
	var sentence = ''
	var sentenceBegining
	var sentenceEnd
	var results = []
	var files = fs.readdirSync('files')
	files.forEach(function(file){
		var data = fs.readFileSync('files/'+file)
		var $ = cheerio.load(data);
		var text = $('p').text();
		text = text.replace(/\s\s+/g, ' ')
		var passed = false

		for(var g = 0; g < queries.length; g++){
			//console.log('queries', queries)
			query = queries[g]		
			//console.log('query',query)
			pos = text.indexOf(query)
			if (pos >= 0 ) { 	//query is matched somewhere in the file
			//console.log('found query')
				/*
				if (file === 'w00091.html'){
					console.log('query', query)
					
					console.log('charAfter', charAfter)
					console.log('snippit', text.substring(pos - 5, pos + query.length +5))
				}
				*/
				var charBefore = text.charAt(pos-1)
				if(charBefore === ' ' || charBefore === "'" || charBefore === '"' || charBefore === '=' || text.charAt(pos) === text.charAt(pos).toUpperCase()){  //query doesn't have a prefix
					//console.log('no prefix')
					var charAfter = text.charAt(pos + query.length)	
					if(charAfter === ',' || charAfter === '.' || charAfter === ' ' || charAfter === '"' || charAfter === "'" || charAfter === '-' ){  //query dosen't have a suffix
						//console.log('no suffix')
						//console.log('passed')
						passed = true
						break 
					}
				}
			} 
		}	
		if (passed) {
			sentenceBegining = 0
			sentenceEnd = pos + 140
			var currentChar = 0
			
			for(var i = pos - 1; i >= 0; i--){
				currentChar = text.charAt(i)
				if (currentChar === '.' || currentChar === '?' || currentChar ==='!') {
					sentenceBegining = i + 2
					break
				}
			}
			for (var j = pos + query.length ; j < text.length; j++) {
				currentChar = text.charAt(j)
				if (currentChar === '.' || currentChar === '?' || currentChar ==='!') {
					sentenceEnd = j
					break
				}
			}
			var sentenceLength = sentenceEnd - sentenceBegining
			if (sentenceLength <= limit){
				sentence = text.substring(sentenceBegining, sentenceEnd+1)
			} else {
				if(pos > sentenceEnd - pos + query.length){  //more characters before query than after
					sentence = text.substring(sentenceBegining, sentenceBegining + limit)
				}
				else if(pos < sentenceEnd - pos + query.length){
					sentence = text.substring(pos, sentenceEnd+1)
				}
				else {
					sentence = text.substring(pos - limit / 2, pos + limit /2)
				}
				//console.log('sentence over', sentence)	
				//console.log('length', sentence.length)	
				//console.log('sentenceLength', sentenceLength)	
			}
			//console.log('sentence', sentence)
			var sentencePos = sentence.indexOf(query)

			var node = h('div', {class: 'item'}, [
				h('div', {class: 'file-name'}, file),
				h('div', [
					sentence.substring(0, sentencePos),
					h('span', {class: 'query'}, query),
					sentence.substring(sentencePos+query.length),
					h('br'),
					sentence.length,
					h('br'),
					query,
					h('br'),
					sentence
					
				])
			])

			//sentence = sentence.replace(query, '<b>' + query + '</b>')

			results.push(node)
		}
		
	})
	return results
	//console.log('results', results)
}


app.listen(8080, function() {
  console.log('Server running at http://127.0.0.1:8080/');
});
