//
//PLAYING CARD GAMES SHARED LOGIC
//

import { currentDeck, resetCardGame } from '../modules/PlayingCards.js';
import { BaseState, BaseStateMachine } from '../modules/StateMachinePattern.js';
import Vector2 from '../modules/Vector2.js';
import { setAllElementWithLogic, getNeighborElsInParent, popRandomFromArr, getCSSDeclaredValue } from '../modules/MyMiscUtil.js';
import{ requestFrame, timer, restartCSSAnimation} from '../modules/CSSAnimationUtil.js';

const GAME = document.getElementById('game');
const GAME_OVERLAY =  GAME.querySelector('#game-overlay');
const GAME_OVERLAY_MSG = GAME_OVERLAY.querySelector('#game-overlay-msg');
const __CARD_WIDTH = getCSSDeclaredValue(GAME, '--card-width', true);
const __HAND_CARD_OFFSET = getCSSDeclaredValue(GAME, '--hand-card-offset', true);
const __ANIM_INSERT_DIST = getCSSDeclaredValue(GAME, '--anim-insert-dist', true);
const __ANIM_FLIPPABLE_TIME = getCSSDeclaredValue(GAME, '--anim-flippable-time', true);
const __ANIM_MOVE_TIME = getCSSDeclaredValue(GAME, '--anim-move-time', true);
const __OVERLAY_FADE_TIME = getCSSDeclaredValue(GAME, '--overlay-fade-time', true);
const __ANIM_MOVE_INITIAL_TRANSITION = getCSSDeclaredValue(GAME, '--anim-move-initial-transition', false);
const HAND_CARD_WIDTH = __CARD_WIDTH + __HAND_CARD_OFFSET;
//
// DRAGGABLE RELATED LOGICS // Very difficult to convert to module
//
//Event Listener Wrapper / Rename
function setSlotLogic(element){element.addEventListener('mouseenter', slotLogic)}
function setDraggableLogic(element){element.addEventListener('mousedown', draggableLogic);} 
function draggableLogic(startEvent){ //MOUSE DOWN EVENT
    const DRAG_TARGET = startEvent.target.closest('.draggable');
    function setDragging(boolean = true){
        GAME.setAttribute('drag-active', boolean);//FOR CSS TO USE THE RIGHT STYLES
        if(boolean){
            requestAnimationFrame(()=>{DRAG_TARGET.classList.add('dragging')});//for flipping animation
            DRAG_TARGET.style.transition = `left 0s, top 0s, margin ${__ANIM_MOVE_TIME}s`;
        }else{
            DRAG_TARGET.classList.remove('dragging'); 
            DRAG_TARGET.style.transition = `${__ANIM_MOVE_INITIAL_TRANSITION}`;
        }
    }
    if(DRAG_TARGET.getAttribute('lock') === "true") return; //IF LOCKED RETURN
    if(GAME.getAttribute('transitioning') === "true") return;
    GAME_STATE_MACHINE.currentState = GAME_STATE.playerDrag;
    let _startSlot = startEvent.target.closest('.slot');
    if(!_startSlot) return; //THIS PREVENT SPAM CLICK
    DRAG_TARGET.style.marginLeft = '0px';
    let _targetRect = DRAG_TARGET.getBoundingClientRect();
    let _targetNeighbors = getNeighborElsInParent(DRAG_TARGET, _startSlot);
    const START_POS = {//remember origin, child index
        mousePos: new Vector2(startEvent.pageX, startEvent.pageY),
        x: _targetRect.x,
        y: _targetRect.y,
        index: [..._startSlot.children].indexOf(DRAG_TARGET),
        slot: _startSlot,
        sibL: _targetNeighbors.prev,
        sibR: _targetNeighbors.next
    };
    let dragTargetWas1st = START_POS.index===1;
    if(START_POS.sibR){//If start sibR exist, apply hand-card width Margin Offset
        START_POS.sibR.style.transition = 'margin 0s';
        requestFrame(()=>{
            START_POS.sibR.style.marginLeft = `${HAND_CARD_WIDTH}px`;
        }).then(()=>{return requestFrame(()=>{
            START_POS.sibR.style.transition = `${__ANIM_MOVE_INITIAL_TRANSITION}`;
        })})
    }
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', releaseDrag);
    DRAG_TARGET.style.position = 'fixed';
    DRAG_TARGET.classList.add('disable-hover-anim'); //For css, disable hover animation
    GAME.appendChild(DRAG_TARGET); setDragging(true); 
    onDrag(startEvent);

    function onDrag(event){
        let _mDeltaX = event.pageX - START_POS.mousePos.x;
        let _mDeltaY = event.pageY - START_POS.mousePos.y;
        let followPos = new Vector2(START_POS.x + _mDeltaX, START_POS.y + _mDeltaY);
        //follow mouse
        DRAG_TARGET.style.left = `${followPos.x}px`;
        DRAG_TARGET.style.top = `${followPos.y}px`;
        //OPTIONAL, BLOCKS GAME TO BE ABLE TO START ANOTHER TRANSITION, USE IF BUGGY
        if(followPos.x!==START_POS.x||followPos.y!==START_POS.y)
            GAME.setAttribute('transitioning', true);
        else {GAME.setAttribute('transitioning', false);}
    } 
    function releaseDrag(_releaseEvent){
        const RELEASE_STATE = {NONE: "None", LEFT_MOST: "L", MIDDLE: "M", RIGHT_MOST: "R"};
        setDragging(false); //set GAME attribute, remove dragging class, set transition
        document.removeEventListener('mousemove', onDrag);
        const ACTIVE_SLOT = GAME.querySelector('.active-slot[lock=false]');//if lock is true, will not be considered active
        let _targetSlot = ACTIVE_SLOT ?? START_POS.slot;
        const IS_SAME_SLOT = _targetSlot === START_POS.slot;
        const TARGET_SLOT = {
            slot: _targetSlot,
            hoverSib :  _targetSlot ? _targetSlot.querySelector('.draggable:hover:not(.dragging)'): null,
            firstChild: _targetSlot ? _targetSlot.firstElementChild : null,
            lastChild: _targetSlot ? _targetSlot.lastElementChild : null,
        }
        let _lastChildRect = TARGET_SLOT.lastChild.getBoundingClientRect();
        let releaseState = (()=>{ //Immediate Invoke, get releaseState
            let _isMouseRight = _releaseEvent.pageX > _lastChildRect.left;
            let _isHovSibFirst = TARGET_SLOT.hoverSib ? TARGET_SLOT.hoverSib === TARGET_SLOT.firstChild : false;
            let _isHovSibLast = TARGET_SLOT.hoverSib ? TARGET_SLOT.hoverSib === TARGET_SLOT.lastChild : false;
            if((_isMouseRight || _isHovSibLast) && ACTIVE_SLOT) 
                return RELEASE_STATE.RIGHT_MOST;
            if(IS_SAME_SLOT && ! TARGET_SLOT.hoverSib)
                return RELEASE_STATE.NONE;
            if(_isHovSibFirst) 
                return RELEASE_STATE.LEFT_MOST;
            return RELEASE_STATE.MIDDLE;
        })();//Immediate Invoke ENDS
        //console.log(releaseState) //DEBUG
        let _targetPos = {};
        switch (releaseState){
            case RELEASE_STATE.NONE:
                _targetPos = {
                    x: START_POS.x,
                    y: START_POS.y,
                    sibL: [...START_POS.slot.children][START_POS.index-1],
                    sibR: [...START_POS.slot.children][START_POS.index],
                };break;
            case RELEASE_STATE.LEFT_MOST:
                var targetRect = TARGET_SLOT.firstChild.getBoundingClientRect();
                _targetPos = {
                    x: targetRect.right + 3, //MAGIC NUMBER
                    y: TARGET_SLOT.slot.getBoundingClientRect().top,
                    sibL: TARGET_SLOT.firstChild,
                    sibR: getNeighborElsInParent(TARGET_SLOT.firstChild, TARGET_SLOT.slot).next,
                };break;
            case RELEASE_STATE.MIDDLE:
                var targetRect = TARGET_SLOT.hoverSib.getBoundingClientRect();
                _targetPos = {
                    x: targetRect.left + HAND_CARD_WIDTH,
                    y: TARGET_SLOT.slot.getBoundingClientRect().top,
                    sibL : TARGET_SLOT.hoverSib,
                    sibR : getNeighborElsInParent(TARGET_SLOT.hoverSib, TARGET_SLOT.slot).next,
                };break;
            case RELEASE_STATE.RIGHT_MOST:
                var targetRect = _lastChildRect; //Already defined above in state checking
                let _isLastAlsoFirst = TARGET_SLOT.firstChild === TARGET_SLOT.lastChild;
                _targetPos = {
                    //if right most is also left most, use left most position
                    x: _isLastAlsoFirst? targetRect.right + 3 : targetRect.left + HAND_CARD_WIDTH,
                    y: TARGET_SLOT.slot.getBoundingClientRect().top,
                    sibL : TARGET_SLOT.lastChild,
                    sibR : getNeighborElsInParent(TARGET_SLOT.lastChild, TARGET_SLOT.slot).next,
                };break;
        } const TARGET_POS = _targetPos;
        //Apply hand card offset if left sibling is a card, aka not first child
        if(TARGET_POS.sibL && TARGET_POS.sibL !== TARGET_SLOT.firstChild) 
            TARGET_POS.sibL.marginRight = `${__HAND_CARD_OFFSET}px`;
        //Make space to card on the right, for insertion
        if(TARGET_POS.sibR) 
            TARGET_POS.sibR.style.marginLeft = `${HAND_CARD_WIDTH}px`;
        //if target position's right sib is not the same as starting position's right sib, reset margin left
        if(START_POS.sibR && START_POS.sibR !== TARGET_POS.sibR){
            START_POS.sibR.style.transition = `${__ANIM_MOVE_INITIAL_TRANSITION}`;
            requestFrame(()=>{START_POS.sibR.style.marginLeft = '0px';})
        }
        //Additional position offset applied if starting slot and target slot is the same
        let _targetSibLIndex = [...TARGET_SLOT.slot.children].indexOf(TARGET_POS.sibL);
        let sameSlotOffset = (()=>{//Immediate Invoke
            if(IS_SAME_SLOT && _targetSibLIndex >= START_POS.index) //
                return dragTargetWas1st ? - __ANIM_INSERT_DIST - HAND_CARD_WIDTH : HAND_CARD_WIDTH;
            return 0;
        })(); //End Immediate Invoke
        //GO TO TARGET POSITION
        DRAG_TARGET.style.left =`${TARGET_POS.x - sameSlotOffset}px`;
        DRAG_TARGET.style.top = `${TARGET_POS.y}px`;
        document.removeEventListener('mouseup', releaseDrag);

        //Using timeout instead of event because event is buggy with spam clicks;
        setTimeout(endTransistion, (1000*__ANIM_MOVE_TIME));

        function endTransistion(){
            //Reset Siblings margins
            [TARGET_POS.sibL, TARGET_POS.sibR].forEach(sib=>{if(sib){
                sib.style.transition = 'margin 0s';
                sib.style.marginLeft = '0px';
                setTimeout(()=>{sib.style.transition = __ANIM_MOVE_INITIAL_TRANSITION},10); //fixes inconsistencies in ffox
            }});
            //This need to wait for the foreach loop to end
            //Enable hover animation again
            requestFrame(()=>{
                DRAG_TARGET.style.position = 'relative';
                DRAG_TARGET.style.left = '0px';
                DRAG_TARGET.style.top = '0px';
                TARGET_SLOT.slot.insertBefore(DRAG_TARGET, TARGET_POS.sibR);
            }).then(()=>{return requestFrame(()=>{
                DRAG_TARGET.style.transition = `${__ANIM_MOVE_INITIAL_TRANSITION}`;
            })}).then(()=>{
                DRAG_TARGET.classList.remove('disable-hover-anim');
                GAME.setAttribute('transitioning', false);
                GAME_STATE_MACHINE.currentState = GAME_STATE.playersTurn;
            })
        } //END endTransistion
    }//END releaseDrag
}//END draggableLogic
function slotLogic(event){
    let slot = event.target;
    slot.classList.add('active-slot');
    slot.addEventListener('mouseleave', _event=>{ slot.classList.remove('active-slot') });
}
//
// Could be in playing-cards.js ?
//
function popCardFromDeck(_targetHand, _deckSelector = '.deck:hover', flipOver=true, isDraggable=true){//TEST
    if(GAME.getAttribute('transitioning') === 'true') return;
    const _deckRect = GAME.querySelector(_deckSelector).getBoundingClientRect();
    const DECK_POS = new Vector2(_deckRect.left, _deckRect.top);
    const _lastChildRect = _targetHand.lastElementChild.getBoundingClientRect();
    const _isFirstLastSame = _targetHand.lastElementChild === _targetHand.firstElementChild;
    const _xOffset = _isFirstLastSame ? _lastChildRect.width + 3  : HAND_CARD_WIDTH; //Magic number 3
    const TARGET_POS = new Vector2(_lastChildRect.left + _xOffset, _lastChildRect.top);
    const NEW_CARD = popRandomFromArr(currentDeck).createElement(); //create card element
    const INNER_CARD = NEW_CARD.querySelector('.flippable');
    GAME.appendChild(NEW_CARD);
    //Set starting pos, initial values
    GAME.setAttribute('transitioning', true);
    NEW_CARD.style.position = 'fixed';
    NEW_CARD.style.transition = __ANIM_MOVE_INITIAL_TRANSITION;
    NEW_CARD.style.left = `${DECK_POS.x}px`; NEW_CARD.style.top = `${DECK_POS.y}px`;
    INNER_CARD.style.transform = 'rotateY(180deg)'; //start on face back

    return requestFrame(()=>{
        NEW_CARD.style.left = `${TARGET_POS.x}px`;
        NEW_CARD.style.top = `${TARGET_POS.y}px`;
        if(flipOver) INNER_CARD.style.transform = 'rotateY(0deg)';
    }).then(()=>{return timer(__ANIM_MOVE_TIME);})
    .then(()=>{return requestFrame(()=>{
        NEW_CARD.style.position = 'relative';
        NEW_CARD.style.left = `${0}px`; NEW_CARD.style.top = `${0}px`;
        INNER_CARD.style.transform = ''; //clear overridden flip transform
        _targetHand.appendChild(NEW_CARD);
        if(isDraggable) setDraggableLogic(NEW_CARD); //Set draggable logic if isDraggable is set to true
        GAME.setAttribute('transitioning', false);
    })})
}

function getCardsFromHand(hand){
   return [...hand.children].slice(1, undefined);
}
//
//BLACK JACK RELATED GAME LOGIC
//
const PLAYER_HAND = GAME.querySelector('#player-hand');
const DEALER_HAND = GAME.querySelector('#dealer-hand');
//WHEN PAGE FINISH LOADING //PROBABLY WANT TO USE DEFERED ON THE SCRIPT INSTEAD
window.onload = function(){
    setAllElementWithLogic('.slot', 'mouseenter', slotLogic);
};

//get buttons
const HIT_BUT = GAME.querySelector('#hit-but');
const STAND_BUT = GAME.querySelector('#stand-but');
const DEAL_BUT = GAME.querySelector('#deal-but');

const GAME_STATE = { 
    deal : new BaseState(
        function enterDeal(){
            HIT_BUT.disabled = true;
            STAND_BUT.disabled = true;
            DEAL_BUT.disabled = false;
            GAME_OVERLAY.style.visibility = 'hidden';
        }
    ), 
    playersTurn: new BaseState(
        function enterPTurn(){
            HIT_BUT.disabled = false;
            STAND_BUT.disabled = false;
            DEAL_BUT.disabled = true;
            if(getBlackJackCardPoints(PLAYER_HAND)>=21) GAME_STATE_MACHINE.currentState = GAME_STATE.dealersTurn;
        }
    ), 
    playerDrag: new BaseState(
        function enterPDrag(){
            HIT_BUT.disabled = true;
            STAND_BUT.disabled = true;
            DEAL_BUT.disabled = true;
        }
    ),
    dealersTurn: new BaseState(
        function enterDTurn(){
            HIT_BUT.disabled = true;
            STAND_BUT.disabled = true;
            DEAL_BUT.disabled = true;
            dealerAILogic(); //start recursion
        }
    ), 
    endTurn: new BaseState(
        function enterEndTurn(){
            endTurnLogic();
        }
    )
};
const GAME_STATE_MACHINE = new BaseStateMachine(GAME_STATE.deal);

async function dealCardsToPlayer(){
    await popCardFromDeck(PLAYER_HAND,'#universal-deck', true, true);
    return popCardFromDeck(PLAYER_HAND,'#universal-deck', true, true);
}
async function dealCardsToDealer(){
    await popCardFromDeck(DEALER_HAND,'#universal-deck', true, false);
    return popCardFromDeck(DEALER_HAND,'#universal-deck', false, false);
}
//Assign functions to global scope, so html button can access
window.dealButtonLogic = async ()=>{
    await dealCardsToPlayer();
    await dealCardsToDealer();
    //go to player's turn in state machine
    GAME_STATE_MACHINE.currentState = GAME_STATE.playersTurn;
}
window.hitPButtonLogic = async ()=>{
    await popCardFromDeck(PLAYER_HAND,'#universal-deck', true, true);
    //get player points, if over or equal to 21, got to dealer turn
    if(getBlackJackCardPoints(PLAYER_HAND) >= 21 ) 
        GAME_STATE_MACHINE.currentState = GAME_STATE.dealersTurn;
}
window.standButtonLogic = async ()=>{
    GAME_STATE_MACHINE.currentState = GAME_STATE.dealersTurn;
}
async function dealerAILogic(){
    if(getBlackJackCardPoints(DEALER_HAND) < 17){
        await popCardFromDeck(DEALER_HAND,'#universal-deck', false, false);
        dealerAILogic(); //recursion
    }
    else{ //end dealer's turn
       requestFrame(()=>{
            GAME_STATE_MACHINE.currentState = GAME_STATE.endTurn;
        })
    }
}
async function endTurnLogic(){
    //await flip all dealer's cards
    GAME.setAttribute('transitioning', true); //disable drag
    const unflippedDealerCards = [...DEALER_HAND.children].slice(2, undefined);
    await new Promise(resolve=>{
        unflippedDealerCards.forEach((card)=>{
            card.querySelector('.flippable').style.transform = 'rotateY(0deg)'; //flip cards over
        });
        setTimeout(resolve, __ANIM_FLIPPABLE_TIME);
    });
    const playerPoints = getBlackJackCardPoints(PLAYER_HAND);
    const dealerPoints = getBlackJackCardPoints(DEALER_HAND);
    const playerBusted = playerPoints > 21;
    const dealerBusted = dealerPoints > 21;
    
    function getGameOverMessage(){
        //win condition //if player not busted, dealer busted or while player not busted, player > dealer
        if(!playerBusted && dealerBusted || !playerBusted && (playerPoints > dealerPoints)){ 
            return 'Win';
        }
        //draw condition //if both busted or both points are equal
        else if(playerBusted && dealerBusted || playerPoints === dealerPoints){ 
            return 'Draw';
        }
        //lose condition //if player busted, dealer not busted or while dealer not busted, dealer > player
        else if(playerBusted && !dealerBusted || !dealerBusted && (dealerPoints > playerPoints)){
            return 'Lose';
        }
    }
    //for now, need a better way to show this
    await timer(1);
    GAME_OVERLAY.style.visibility = 'visible';
    GAME_OVERLAY_MSG.innerHTML = getGameOverMessage();
    await restartCSSAnimation(GAME_OVERLAY);
    await timer(__OVERLAY_FADE_TIME);
    await resetCardGameWithTransition();
    GAME_STATE_MACHINE.currentState = GAME_STATE.deal;
    GAME.setAttribute('transitioning', false); //enable drag for cards again
}
async function resetCardGameWithTransition(){
    const cards = GAME.querySelectorAll('.outer-card:not(.prototype)');
    console.log([...cards].length);
    const deckRect = GAME.querySelector('#universal-deck').getBoundingClientRect();
    [...cards].forEach(card=>{
        let cardRect = card.getBoundingClientRect();
        requestFrame(()=>{
            card.querySelector('.flippable').style.transform = `rotateY(180deg)`;
        }).then(()=>{return requestFrame(()=>{
            card.style.position = 'fixed'
            card.style.transition = 'left 0s, top 0s';
            card.style.left = `${cardRect.left}px`;
            card.style.top = `${cardRect.top}px`;
        })}).then(()=>{return requestFrame(()=>{//flip card over
            card.style.transition = __ANIM_MOVE_INITIAL_TRANSITION; //__ANIM_MOVE_INITIAL_TRANSITION
            card.style.left = `${deckRect.left}px`;
            card.style.top = `${deckRect.top}px`;
        })});
    });
    await timer(__ANIM_MOVE_TIME); //__ANIM_MOVE_TIME
    resetCardGame();
}
function getBlackJackCardPoints(hand){ //not the most efficient way to do calculation, but most managable
    let aceCounter = 0;
    function getCardPoint(_cardEl){
        switch(_cardEl._number_){
            case 'A': aceCounter++; return 11; //Return 11 for now, will -10 later
            case 'J': case 'Q': case 'K': return 10;
            default: return parseInt(_cardEl._number_);
        }
    }
    const cardElements = getCardsFromHand(hand); //returns all the cards, minus the starting child
    var totalSum = cardElements.reduce((prev, cur)=>{return prev + getCardPoint(cur)}, 0); //starts with 0, so no type checking needed
    while(totalSum > 21 && aceCounter > 0){ //if total is bust, and has ace in hand, -10 to total sum
        aceCounter--; totalSum -= 10;
    }
    return totalSum;
}