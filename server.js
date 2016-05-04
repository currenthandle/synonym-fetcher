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
		var text
		var passed = false
		var text = $('p').text().replace(/\s\s+/g, ' ')

		searchText = text
		outer:
		for(var g = 0; g < queries.length; g++){  //check every query until one in found in the current file
			query = queries[g]		
			while(searchText.indexOf(query) > -1){	//check entire file for current querry
				pos = searchText.indexOf(query) 
				
				//query is matched somewhere in the file
				if (pos >= 0 ) { 	
					pos += text.length-searchText.length
					
					var charBefore = text.charAt(pos-1)
					
					//query doesn't have a prefix
					if(charBefore === ' ' || charBefore === "'" || charBefore === '"' || charBefore === '=' || text.charAt(pos) === text.charAt(pos).toUpperCase()){  
						var charAfter = text.charAt(pos + query.length)	
						
						//query dosen't have a suffix
						if(charAfter === ',' || charAfter === '.' || charAfter === ' ' || charAfter === '"' || charAfter === "'" || charAfter === '-' ){  
							passed = true
					
							break outer
						}
					}
				} 
				searchText = searchText.substring(pos+query.length)
			}
		}	
		if (passed) {
			sentenceBegining = 0
			sentenceEnd = pos + limit
			
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
			// Sentence is sorter than limit
			if (sentenceLength <= limit){
				sentence = text.substring(sentenceBegining, sentenceEnd+1)
			} else {
				//more characters before query than after
				if(pos > sentenceEnd - pos + query.length){  
					sentence = text.substring(sentenceBegining, pos+query.length)
					while(sentence.length > limit){
						sentence = sentence.substr(1)
					}
				}
				//more characters after query than after
				else if(pos < sentenceEnd - pos + query.length){
					sentence = text.substring(pos, sentenceEnd+1)
				}
				//equal characters before and after query
				else {
					sentence = text.substring(pos - limit / 2, pos + limit /2)
				}
			}
			var sentencePos = sentence.indexOf(query)

			//generate virtual DOM nodes from query results			
			var node = h('div', {class: 'item'}, [
				h('div', {class: 'file-name'}, file),
				h('div', [
					sentence.substring(0, sentencePos),
					h('span', {class: 'query'}, query),
					sentence.substring(sentencePos+query.length),
				])
			])

			results.push(node)
		}
		
	})
	return results
}


app.listen(process.env.PORT || 5000, function() {
  console.log('Server running on port 5000');
})
