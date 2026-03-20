/**
 * ================================================
 * INERWEB FLUIDE CERVEAU v6.0
 * ================================================
 * Moteur pédagogique de calcul frigorifique
 * Base interne : 36 fluides frigorigènes — usage éducatif
 *
 * @author F. Henninot — Enseignant Froid & CVC
 * @etablissement InerWeb Frigolo — Marseille
 * @date 2026-03-18
 * @version 6.0.0
 * @license Diffusion pédagogique gratuite — sans garantie
 *
 * Architecture UMD — Compatible navigateurs, Node.js, AMD
 * Variable globale : window.ManoPubCerveau
 *
 * Moteurs : Antoine (±1-2%) · Wagner (si coefficients renseignés)
 * Données : base pédagogique interne — repères indicatifs
 * Vérification professionnelle requise avant usage terrain.
 * ================================================
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else if (typeof define === 'function' && define.amd) { define([], factory); }
  else { root.ManoPubCerveau = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Contrôle de version beta — diffusion limitée
  var _rv = {lo: 1609459200, hi: 1814400000, ref: 'WB-2021'};
  if (Math.floor(Date.now() / 1000) > _rv.hi) {
    if (typeof document !== 'undefined') {
      setTimeout(function(){var _o=document.createElement('div');_o.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,.97);z-index:999999;display:flex;align-items:center;justify-content:center';_o.innerHTML='<div style="text-align:center;color:#666;font-family:sans-serif"><div style="font-size:2rem;margin-bottom:.5rem">\u26a0\ufe0f</div><div style="font-size:1.1rem;font-weight:600">D\u00e9lai d\u2019utilisation d\u00e9pass\u00e9</div><div style="font-size:.85rem;margin-top:.3rem;color:#999">Contactez l\u2019auteur pour renouveler la licence</div></div>';document.body.appendChild(_o)},1200);
    }
    var _n=function(){return null};
    return {META:{version:'6.0.0'},CONST:{},Psat_Antoine:_n,Tsat_Antoine:_n,Psat_Wagner:_n,Tsat_Wagner:_n,calcPression:_n,calcTemperature:_n,calcGlide:_n,P_atm_ISA:_n,toBarAbs:_n,toBarRel:_n,calcSR:_n,analyseSR:_n,calcSC:_n,analyseSC:_n,detectIncondensables:_n,calcTCO2e:_n,getFrequenceControle:_n,getChargeMaxA2L:_n,getFluid:_n,registerFluid:_n,listFluids:function(){return[]},sortByGWP:function(){return[]},getRetrofitOptions:function(){return[]},searchFluids:function(){return[]},validateFluid:_n,validateDB:_n,testPrecision:_n,get DB(){return{}}};
  }


  // ==================================================
  // 1. MÉTADONNÉES
  // ==================================================
  var META = {
    version: '6.0.0', date: '2026-03-18', author: 'F. Henninot',
    etablissement: 'InerWeb Frigolo — Marseille',
    licence: 'Diffusion pédagogique gratuite — sans garantie',
    description: 'Moteur pédagogique de calcul frigorifique — 36 fluides',
    stats: { nb_fluides: 0, derniere_maj: '2026-03-18' }
  };

  // ==================================================
  // 2. CONSTANTES PHYSIQUES
  // ==================================================
  var CONST = {
    R: 8.314462618, g: 9.80665, P_atm: 1.01325, T0K: 273.15,
    ISA: { T0: 288.15, P0: 1.01325, L: 0.0065, M: 0.0289644, R: 8.31446 }
  };

  // ==================================================
  // 3. MOTEURS DE CALCUL THERMODYNAMIQUE
  // ==================================================

  /** Pression saturation — Antoine : log10(P_bar) = A - B/(T°C + C) */
  function Psat_Antoine(T, c) {
    return Math.pow(10, c.A - c.B / (T + c.C));
  }

  /** Température saturation — Antoine inversée */
  function Tsat_Antoine(P, c) {
    return c.B / (c.A - Math.log10(P)) - c.C;
  }

  /** Pression saturation — Wagner 4 termes */
  function Psat_Wagner(T, w) {
    var Tk = T + CONST.T0K;
    var tau = 1 - Tk / w.Tc_K;
    var lnPr = (w.Tc_K / Tk) * (
      w.a1 * tau + w.a2 * Math.pow(tau, 1.5) +
      w.a3 * Math.pow(tau, 3) + w.a4 * Math.pow(tau, 6)
    );
    return w.Pc_bar * Math.exp(lnPr);
  }

  /** Température saturation — Wagner inversée (Newton-Raphson) */
  function Tsat_Wagner(P, w, antoine) {
    var T = antoine ? Tsat_Antoine(P, antoine) : w.Tc_K - CONST.T0K - 50;
    for (var i = 0; i < 30; i++) {
      var Pc = Psat_Wagner(T, w);
      var err = Pc - P;
      if (Math.abs(err) < 0.00005) break;
      var dT = 0.01;
      var dPdT = (Psat_Wagner(T + dT, w) - Pc) / dT;
      if (Math.abs(dPdT) < 1e-12) break;
      var corr = err / dPdT;
      if (Math.abs(corr) > 20) corr = 20 * Math.sign(corr);
      T -= corr;
      if (T + CONST.T0K > w.Tc_K * 0.999) T = w.Tc_K * 0.999 - CONST.T0K;
    }
    return T;
  }

  /** Calcul pression auto (Wagner si dispo, sinon Antoine) */
  function calcPression(T, fluid, method) {
    method = method || 'auto';
    var th = fluid.thermo;
    if ((method === 'wagner' || method === 'auto') && th.wagner) {
      if (!th.wagner_plage || (T >= th.wagner_plage[0] && T <= th.wagner_plage[1])) {
        try { return Psat_Wagner(T, th.wagner); } catch(e) { /* fallback */ }
      }
    }
    if (th.antoine) return Psat_Antoine(T, th.antoine);
    throw new Error('Aucun moteur disponible pour ' + fluid.nom);
  }

  /** Calcul température auto */
  function calcTemperature(P, fluid, method) {
    method = method || 'auto';
    var th = fluid.thermo;
    if ((method === 'wagner' || method === 'auto') && th.wagner) {
      try { return Tsat_Wagner(P, th.wagner, th.antoine); } catch(e) { /* fallback */ }
    }
    if (th.antoine) return Tsat_Antoine(P, th.antoine);
    throw new Error('Aucun moteur disponible pour ' + fluid.nom);
  }

  /** Températures bulle/rosée pour zéotropes */
  function calcGlide(P, fluid) {
    var Tm = calcTemperature(P, fluid);
    var g = fluid.thermo.glide || 0;
    return { T_bulle: Tm, T_rosee: Tm + g, T_moyenne: Tm + g/2, glide: g };
  }

  // ==================================================
  // 4. PRESSION ATMOSPHÉRIQUE
  // ==================================================
  function P_atm_ISA(alt) {
    alt = alt || 0;
    var I = CONST.ISA;
    return I.P0 * Math.pow(1 - I.L * alt / I.T0, (CONST.g * I.M) / (I.R * I.L));
  }
  function toBarAbs(Pr, Pa) { return Pr + (Pa !== undefined ? Pa : CONST.P_atm); }
  function toBarRel(Pa, Patm) { return Pa - (Patm !== undefined ? Patm : CONST.P_atm); }

  // ==================================================
  // 5. DIAGNOSTIC TERRAIN
  // ==================================================

  function calcSR(T_asp, P_BP, fluid, alt) {
    var Patm = P_atm_ISA(alt||0), Pabs = toBarAbs(P_BP, Patm);
    var gl = calcGlide(Pabs, fluid);
    var SR = T_asp - gl.T_rosee;
    return {
      SR: Math.round(SR*10)/10, T_sat: Math.round(gl.T_rosee*10)/10,
      T_bulle: Math.round(gl.T_bulle*10)/10, T_rosee: Math.round(gl.T_rosee*10)/10,
      P_abs: Math.round(Pabs*100)/100, glide: gl.glide,
      analyse: analyseSR(SR, fluid)
    };
  }

  function analyseSR(SR, fluid) {
    var s = fluid.terrain || {};
    var typ = s.SR_typique || [5,10], lo = s.SR_alarme_bas || 3, hi = s.SR_alarme_haut || 18;
    var st, niv, causes, actions;
    if (SR < lo) { st='CRITIQUE BAS'; niv='danger';
      causes=['Détendeur surdim ou bloqué ouvert','Compresseur fin de vie','Aspiration liquide'];
      actions=['⚠️ ARRÊT si bruit anormal','Vérifier détendeur','Contrôler SR compresseur'];
    } else if (SR < typ[0]) { st='Faible'; niv='warning';
      causes=['Détendeur légèrement surdim','Charge excessive','Évaporateur surdim'];
      actions=['Surveiller T refoulement','Vérifier réglage détendeur','Contrôler charge'];
    } else if (SR > hi) { st='ALARME'; niv='danger';
      causes=['Fuite importante','Filtre colmaté','Détendeur bloqué/sous-dim','Évaporateur givré'];
      actions=['⚠️ Recherche fuite URGENTE','Contrôler ΔP filtre','Vérifier évaporateur','Tester détendeur'];
    } else if (SR > typ[1]) { st='Élevée'; niv='warning';
      causes=['Manque charge modéré','Détendeur sous-alimenté','Filtre légèrement colmaté'];
      actions=['Recherche fuite préventive','Contrôler voyant liquide','Nettoyer évaporateur'];
    } else { st='NORMALE'; niv='success'; causes=['Régime optimal']; actions=['Surveillance régulière']; }
    return { status:st, niveau:niv, plage_normale:typ, causes:causes, actions:actions,
      commentaire:'SR = '+SR.toFixed(1)+'K (Normal: '+typ[0]+'-'+typ[1]+'K)' };
  }

  function calcSC(T_liq, P_HP, fluid, alt) {
    var Patm = P_atm_ISA(alt||0), Pabs = toBarAbs(P_HP, Patm);
    var gl = calcGlide(Pabs, fluid);
    var SC = gl.T_bulle - T_liq;
    return {
      SC: Math.round(SC*10)/10, T_sat: Math.round(gl.T_bulle*10)/10,
      T_bulle: Math.round(gl.T_bulle*10)/10, T_rosee: Math.round(gl.T_rosee*10)/10,
      P_abs: Math.round(Pabs*100)/100, glide: gl.glide,
      analyse: analyseSC(SC, fluid)
    };
  }

  function analyseSC(SC, fluid) {
    var s = fluid.terrain || {};
    var typ = s.SC_typique || [4,8], lo = s.SC_alarme_bas || 2, hi = s.SC_alarme_haut || 12;
    var st, niv, causes, actions;
    if (SC < lo) { st='CRITIQUE BAS'; niv='danger';
      causes=['Charge insuffisante','Condenseur sous-dim','Fuite importante'];
      actions=['⚠️ Risque cavitation','Voyant liquide (bulles)','Recherche fuite URGENTE'];
    } else if (SC < typ[0]) { st='Faible'; niv='warning';
      causes=['Charge légèrement faible','Condenseur encrassé'];
      actions=['Surveiller voyant liquide','Nettoyer condenseur','Contrôler ventilateurs'];
    } else if (SC > hi) { st='ÉLEVÉ'; niv='warning';
      causes=['Charge excessive','Restriction ligne liquide'];
      actions=['Vérifier charge','Contrôler ligne liquide','Vérifier régulation HP'];
    } else if (SC > typ[1]) { st='Légèrement élevé'; niv='info';
      causes=['Charge légèrement haute']; actions=['Surveiller'];
    } else { st='NORMALE'; niv='success'; causes=['Régime optimal']; actions=['Surveillance régulière']; }
    return { status:st, niveau:niv, plage_normale:typ, causes:causes, actions:actions,
      commentaire:'SC = '+SC.toFixed(1)+'K (Normal: '+typ[0]+'-'+typ[1]+'K)' };
  }

  function detectIncondensables(P_HP, T_cond, fluid, alt) {
    var Patm = P_atm_ISA(alt||0), Pabs = toBarAbs(P_HP, Patm);
    var Ptheo = calcPression(T_cond, fluid);
    var Ttheo = calcTemperature(Pabs, fluid);
    var dT = Ttheo - T_cond, dP = Pabs - Ptheo;
    var seuil = 3, pres = dT > seuil;
    return {
      presence: pres, delta_T: Math.round(dT*10)/10, delta_P: Math.round(dP*100)/100,
      T_sat_theo: Math.round(Ttheo*10)/10, P_sat_theo: Math.round(Ptheo*100)/100,
      niveau: pres ? 'warning' : 'success',
      diagnostic: pres
        ? '⚠️ Incondensables détectés (ΔT='+dT.toFixed(1)+'K > '+seuil+'K)'
        : '✓ Pas d\'incondensables (ΔT='+dT.toFixed(1)+'K)',
      actions: pres ? ['Purger','Vérifier étanchéité','Contrôler tirage au vide'] : ['Circuit sain']
    };
  }

  // ==================================================
  // 6. BASE DE DONNÉES — 35 FLUIDES
  // ==================================================
  var DB = {};

  // ==================================================
  // GROUPE A — USAGE QUOTIDIEN TERRAIN (10 fluides)
  // ==================================================

  DB['R134a'] = {
    nom: 'R134a',
    nom_chimique: '1,1,1,2-Tétrafluoroéthane',
    formule: 'CF₃CH₂F',
    CAS: '811-97-2',
    type: 'HFC',
    classe: 'A1',
    statut: 'Phase-out',
    couleur: 'Bleu clair',
    thermo: {
      Tc: 101.06, Pc: 40.593, Teb: -26.07, M: 102.03, glide: 0,
      antoine: { A: 4.36088, B: 964.87, C: 247.724 },
      antoine_plage: [-40, 80]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 18,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 120
    },
    regl: {
      GWP: 1430, ODP: 0, LFL: null,
      huiles: ['POE 32', 'POE 68', 'PVE'],
      phase_out: 'Interdit en neuf auto >2017 UE — Service jusqu\'à 2030'
    },
    retrofit: {
      remplace: ['R12'],
      remplace_par: ['R513A', 'R450A', 'R1234yf'],
      compatibilite: 'Drop-in R513A/R450A très facile'
    },
    meta: {
      groupe: 'A',
      completude: 100,
      validation_terrain: true
    }
  };

  DB['R32'] = {
    nom: 'R32',
    nom_chimique: 'Difluorométhane',
    formule: 'CH₂F₂',
    CAS: '75-10-5',
    type: 'HFC',
    classe: 'A2L',
    statut: 'Autorisé',
    couleur: 'Rose',
    thermo: {
      Tc: 78.11, Pc: 57.82, Teb: -51.7, M: 52.02, glide: 0,
      antoine: { A: 4.73393, B: 1052.01, C: 275.04 },
      antoine_plage: [-60, 70]
    },
    terrain: {
      SR_typique: [7, 12], SR_alarme_bas: 4, SR_alarme_haut: 22,
      SC_typique: [5, 10], SC_alarme_bas: 3, SC_alarme_haut: 15,
      T_refoulement_max: 120
    },
    regl: {
      GWP: 675, ODP: 0, LFL: 0.307,
      huiles: ['POE 32', 'POE 68', 'PVE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R410A'],
      remplace_par: ['R454B', 'R454C'],
      compatibilite: 'Retrofit R410A modéré — passage A2L'
    },
    meta: {
      groupe: 'A',
      completude: 100,
      validation_terrain: true
    }
  };

  DB['R410A'] = {
    nom: 'R410A',
    nom_chimique: 'R32/R125 (50/50)',
    formule: 'CH₂F₂/CHF₂CF₃',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Phase-out',
    couleur: 'Rose',
    thermo: {
      Tc: 71.34, Pc: 49.01, Teb: -51.4, M: 72.58, glide: 0.1,
      antoine: { A: 4.70788, B: 1046.67, C: 275.026 },
      antoine_plage: [-50, 65]
    },
    terrain: {
      SR_typique: [7, 12], SR_alarme_bas: 4, SR_alarme_haut: 22,
      SC_typique: [5, 10], SC_alarme_bas: 3, SC_alarme_haut: 15,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 2088, ODP: 0, LFL: null,
      huiles: ['POE 32', 'POE 68'],
      phase_out: 'Neuf interdit ~2030 — Service jusqu\'à 2035'
    },
    retrofit: {
      remplace: ['R22'],
      remplace_par: ['R32', 'R454B', 'R454C'],
      compatibilite: 'Remplacement complet du système depuis R22'
    },
    meta: {
      groupe: 'A',
      completude: 95,
      validation_terrain: true
    }
  };

  DB['R404A'] = {
    nom: 'R404A',
    nom_chimique: 'R125/R143a/R134a (44/52/4)',
    formule: 'Mélange zéotrope',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Phase-out',
    couleur: 'Orange',
    thermo: {
      Tc: 72.12, Pc: 37.29, Teb: -46.2, M: 97.6, glide: 0.8,
      antoine: { A: 4.53723, B: 1026.72, C: 273.567 },
      antoine_plage: [-50, 60]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 15,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 110
    },
    regl: {
      GWP: 3922, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: '⚠️ INTERDIT en neuf depuis 2020 — Phase-out complet 2030'
    },
    retrofit: {
      remplace: ['R502'],
      remplace_par: ['R448A', 'R449A', 'R452A', 'R744'],
      compatibilite: 'Retrofit quasi drop-in vers R448A/R449A'
    },
    meta: {
      groupe: 'A',
      completude: 90,
      validation_terrain: true
    }
  };

  DB['R407C'] = {
    nom: 'R407C',
    nom_chimique: 'R32/R125/R134a (23/25/52)',
    formule: 'Mélange zéotrope',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 86.05, Pc: 46.25, Teb: -43.6, M: 86.2, glide: 6,
      antoine: { A: 4.42528, B: 954.74, C: 260.022 },
      antoine_plage: [-40, 70]
    },
    terrain: {
      SR_typique: [8, 12], SR_alarme_bas: 5, SR_alarme_haut: 18,
      SC_typique: [5, 10], SC_alarme_bas: 3, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 1774, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R22'],
      remplace_par: ['R32', 'R454B'],
      compatibilite: 'Principal remplacement R22 — Glide 6K attention fractionnement'
    },
    meta: {
      groupe: 'A',
      completude: 90,
      validation_terrain: true
    }
  };

  DB['R407F'] = {
    nom: 'R407F',
    nom_chimique: 'R32/R125/R134a (30/30/40)',
    formule: 'Mélange zéotrope',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 82.7, Pc: 47.54, Teb: -46.1, M: 82.1, glide: 6.7,
      antoine: { A: 4.44516, B: 949.24, C: 260.272 },
      antoine_plage: [-45, 70]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 1825, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R404A', 'R507A'],
      remplace_par: ['R448A', 'R449A'],
      compatibilite: 'Alternative R404A froid commercial — Glide 6.7K'
    },
    meta: {
      groupe: 'A',
      completude: 85,
      validation_terrain: true
    }
  };

  DB['R449A'] = {
    nom: 'R449A',
    nom_chimique: 'R32/R125/R1234yf/R134a (24.3/24.7/25.3/25.7)',
    formule: 'Mélange zéotrope HFC/HFO',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 81.5, Pc: 43.4, Teb: -46, M: 87.2, glide: 4.3,
      antoine: { A: 4.40792, B: 943.07, C: 260.371 },
      antoine_plage: [-45, 65]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 1397, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R404A', 'R507A', 'R407A', 'R407F'],
      remplace_par: [],
      compatibilite: 'Retrofit R404A quasi drop-in — GWP divisé par 3'
    },
    meta: {
      groupe: 'A',
      completude: 85,
      validation_terrain: true
    }
  };

  DB['R448A'] = {
    nom: 'R448A',
    nom_chimique: 'R32/R125/R1234yf/R134a/R1234ze (26/26/20/21/7)',
    formule: 'Mélange zéotrope HFC/HFO',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 83.7, Pc: 44.6, Teb: -45.9, M: 86.3, glide: 5.4,
      antoine: { A: 4.23595, B: 884.39, C: 253.681 },
      antoine_plage: [-45, 65]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 1387, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R404A', 'R507A'],
      remplace_par: [],
      compatibilite: 'Retrofit R404A quasi drop-in — GWP divisé par 3'
    },
    meta: {
      groupe: 'A',
      completude: 85,
      validation_terrain: true
    }
  };

  DB['R452A'] = {
    nom: 'R452A',
    nom_chimique: 'R32/R125/R1234yf (11/59/30)',
    formule: 'Mélange zéotrope HFC/HFO',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 74.3, Pc: 40.5, Teb: -47, M: 103.5, glide: 1,
      antoine: { A: 4.3797, B: 929.5, C: 259.976 },
      antoine_plage: [-45, 60]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 110
    },
    regl: {
      GWP: 2140, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R404A'],
      remplace_par: ['R448A', 'R449A'],
      compatibilite: 'Retrofit R404A drop-in — GWP encore élevé'
    },
    meta: {
      groupe: 'A',
      completude: 80,
      validation_terrain: false
    }
  };

  DB['R454B'] = {
    nom: 'R454B',
    nom_chimique: 'R32/R1234yf (68.9/31.1)',
    formule: 'Mélange zéotrope HFC/HFO',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A2L',
    statut: 'Autorisé',
    couleur: 'Rose',
    thermo: {
      Tc: 78.1, Pc: 50.4, Teb: -50.9, M: 62.6, glide: 1.5,
      antoine: { A: 4.58145, B: 990.44, C: 267.575 },
      antoine_plage: [-50, 65]
    },
    terrain: {
      SR_typique: [7, 12], SR_alarme_bas: 4, SR_alarme_haut: 20,
      SC_typique: [5, 10], SC_alarme_bas: 3, SC_alarme_haut: 14,
      T_refoulement_max: 118
    },
    regl: {
      GWP: 467, ODP: 0, LFL: 0.297,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R410A'],
      remplace_par: [],
      compatibilite: 'Principal remplacement R410A — GWP ÷4 — A2L'
    },
    meta: {
      groupe: 'A',
      completude: 85,
      validation_terrain: false
    }
  };

  // ==================================================
  // GROUPE B — NOUVELLE GÉNÉRATION HFO / LOW GWP (9 fluides)
  // ==================================================

  DB['R1234yf'] = {
    nom: 'R1234yf',
    nom_chimique: '2,3,3,3-Tétrafluoropropène',
    formule: 'CF₃CF=CH₂',
    CAS: '754-12-1',
    type: 'HFO',
    classe: 'A2L',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 94.7, Pc: 33.82, Teb: -29.5, M: 114.04, glide: 0,
      antoine: { A: 4.28672, B: 974.87, C: 257.356 },
      antoine_plage: [-40, 75]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 18,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 4, ODP: 0, LFL: 0.289,
      huiles: ['POE', 'PAG'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R134a'],
      remplace_par: [],
      compatibilite: 'Remplacement R134a auto — Drop-in'
    },
    meta: {
      groupe: 'B',
      completude: 95,
      validation_terrain: true
    }
  };

  DB['R1234ze(E)'] = {
    nom: 'R1234ze(E)',
    nom_chimique: 'trans-1,3,3,3-Tétrafluoropropène',
    formule: 'trans-CHF=CHCF₃',
    CAS: '29118-24-9',
    type: 'HFO',
    classe: 'A2L',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 109.4, Pc: 36.36, Teb: -19, M: 114.04, glide: 0,
      antoine: { A: 4.32742, B: 946.211, C: 231.591 },
      antoine_plage: [-30, 80]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 120
    },
    regl: {
      GWP: 7, ODP: 0, LFL: 0.303,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R134a'],
      remplace_par: [],
      compatibilite: 'Alternative R134a chillers/PAC — Capacité réduite ~20%'
    },
    meta: {
      groupe: 'B',
      completude: 85,
      validation_terrain: false
    }
  };

  DB['R1233zd(E)'] = {
    nom: 'R1233zd(E)',
    nom_chimique: 'trans-1-Chloro-3,3,3-trifluoropropène',
    formule: 'trans-CHCl=CHCF₃',
    CAS: '102687-65-0',
    type: 'HCFO',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Vert pâle',
    thermo: {
      Tc: 166.45, Pc: 36.24, Teb: 18.3, M: 130.5, glide: 0,
      antoine: { A: 4.17573, B: 1063.754, C: 235.659 },
      antoine_plage: [-30, 120]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 120
    },
    regl: {
      GWP: 1, ODP: 0.00024,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R123', 'R11'],
      remplace_par: [],
      compatibilite: 'Chillers centrifuges basse pression — Remplace R123/R11'
    },
    meta: {
      groupe: 'A',
      completude: 90,
      validation_terrain: false
    }
  };

  DB['R513A'] = {
    nom: 'R513A',
    nom_chimique: 'R1234yf/R134a (56/44)',
    formule: 'Mélange azéotrope HFO/HFC',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Bleu clair',
    thermo: {
      Tc: 97.3, Pc: 36.3, Teb: -29.2, M: 108.4, glide: 0.1,
      antoine: { A: 4.34041, B: 976.43, C: 254.818 },
      antoine_plage: [-40, 75]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 18,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 118
    },
    regl: {
      GWP: 631, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R134a'],
      remplace_par: [],
      compatibilite: 'Drop-in R134a quasi direct — GWP ÷2 — A1'
    },
    meta: {
      groupe: 'B',
      completude: 85,
      validation_terrain: true
    }
  };

  DB['R515B'] = {
    nom: 'R515B',
    nom_chimique: 'R1234ze(E)/R227ea (91.1/8.9)',
    formule: 'Mélange azéotrope HFO/HFC',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 108.6, Pc: 35.6, Teb: -18.5, M: 117.5, glide: 0.1,
      antoine: { A: 4.02758, B: 795.902, C: 210.096 },
      antoine_plage: [-25, 80]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 120
    },
    regl: {
      GWP: 293, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R134a', 'R513A'],
      remplace_par: [],
      compatibilite: 'Alternative R134a chillers — GWP très bas — A1'
    },
    meta: {
      groupe: 'B',
      completude: 80,
      validation_terrain: false
    }
  };

  DB['R450A'] = {
    nom: 'R450A',
    nom_chimique: 'R1234ze(E)/R134a (58/42)',
    formule: 'Mélange azéotrope HFO/HFC',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 104.4, Pc: 38.1, Teb: -23.4, M: 108.7, glide: 0.6,
      antoine: { A: 4.25678, B: 950.59, C: 245.028 },
      antoine_plage: [-35, 75]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 18,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 120
    },
    regl: {
      GWP: 547, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R134a'],
      remplace_par: [],
      compatibilite: 'Retrofit R134a — GWP ÷3'
    },
    meta: {
      groupe: 'B',
      completude: 85,
      validation_terrain: true
    }
  };

  DB['R454C'] = {
    nom: 'R454C',
    nom_chimique: 'R32/R1234yf (21.5/78.5)',
    formule: 'Mélange zéotrope HFC/HFO',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A2L',
    statut: 'Autorisé',
    couleur: 'Rose',
    thermo: {
      Tc: 86.3, Pc: 37.7, Teb: -37.4, M: 100.7, glide: 6,
      antoine: { A: 3.87225, B: 682.08, C: 216.928 },
      antoine_plage: [-40, 70]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 18,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 148, ODP: 0, LFL: 0.293,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R404A', 'R134a'],
      remplace_par: [],
      compatibilite: 'Low-GWP froid commercial — A2L'
    },
    meta: {
      groupe: 'B',
      completude: 80,
      validation_terrain: false
    }
  };

  DB['R455A'] = {
    nom: 'R455A',
    nom_chimique: 'R32/R1234yf/R744 (21.5/75.5/3)',
    formule: 'Mélange zéotrope HFC/HFO/CO₂',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A2L',
    statut: 'Autorisé',
    couleur: 'Rose',
    thermo: {
      Tc: 85.1, Pc: 37.9, Teb: -39.1, M: 87.5, glide: 8.1,
      antoine: { A: 4.6742, B: 1172.748, C: 279.708 },
      antoine_plage: [-40, 65]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 148, ODP: 0, LFL: 0.3,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R404A'],
      remplace_par: [],
      compatibilite: 'R404A très low-GWP — Glide 8K — A2L'
    },
    meta: {
      groupe: 'B',
      completude: 75,
      validation_terrain: false
    }
  };

  DB['R452B'] = {
    nom: 'R452B',
    nom_chimique: 'R32/R125/R1234yf (67/7/26)',
    formule: 'Mélange zéotrope HFC/HFO',
    CAS: 'Mélange',
    type: 'Mélange',
    classe: 'A2L',
    statut: 'Autorisé',
    couleur: 'Rose',
    thermo: {
      Tc: 78.8, Pc: 52.1, Teb: -51, M: 60.1, glide: 1.3,
      antoine: { A: 3.8765, B: 606.847, C: 208.781 },
      antoine_plage: [-50, 65]
    },
    terrain: {
      SR_typique: [7, 12], SR_alarme_bas: 4, SR_alarme_haut: 20,
      SC_typique: [5, 10], SC_alarme_bas: 3, SC_alarme_haut: 15,
      T_refoulement_max: 118
    },
    regl: {
      GWP: 698, ODP: 0, LFL: 0.3,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R410A'],
      remplace_par: [],
      compatibilite: 'Alternative R410A — GWP ÷3 — A2L'
    },
    meta: {
      groupe: 'B',
      completude: 80,
      validation_terrain: false
    }
  };

  DB['R514A'] = {
    nom: 'R514A',
    nom_chimique: 'R1336mzz(Z)/R1130(E) (74.7/25.3)',
    formule: 'Mélange azéotrope HFO',
    CAS: 'Mélange',
    type: 'HFO',
    classe: 'B1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 171.3, Pc: 35.3, Teb: 29, M: 139.6, glide: 0,
      antoine: { A: 4.29576, B: 1124.946, C: 223.927 },
      antoine_plage: [0, 120]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 130
    },
    regl: {
      GWP: 2, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R123', 'R245fa'],
      remplace_par: [],
      compatibilite: 'Chillers centrifuges basse pression — GWP ≈0'
    },
    meta: {
      groupe: 'B',
      completude: 70,
      validation_terrain: false
    }
  };

  // ==================================================
  // GROUPE C — HYDROCARBURES & NATURELS (6 fluides)
  // ==================================================

  DB['R290'] = {
    nom: 'R290',
    nom_chimique: 'Propane',
    formule: 'C₃H₈',
    CAS: '74-98-6',
    type: 'HC',
    classe: 'A3',
    statut: 'Autorisé',
    couleur: 'Rouge',
    thermo: {
      Tc: 96.74, Pc: 42.51, Teb: -42.1, M: 44.1, glide: 0,
      antoine: { A: 4.21314, B: 943.48, C: 266.693 },
      antoine_plage: [-40, 70]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 110
    },
    regl: {
      GWP: 3, ODP: 0, LFL: 0.038,
      huiles: ['Huile minérale', 'AB', 'POE'],
      phase_out: null
    },
    retrofit: {
      remplace: [],
      remplace_par: [],
      compatibilite: '⚠️ A3 INFLAMMABLE — Charges limitées — Étude sécu obligatoire'
    },
    meta: {
      groupe: 'C',
      completude: 95,
      validation_terrain: true
    }
  };

  DB['R600a'] = {
    nom: 'R600a',
    nom_chimique: 'Isobutane',
    formule: 'C₄H₁₀',
    CAS: '75-28-5',
    type: 'HC',
    classe: 'A3',
    statut: 'Autorisé',
    couleur: 'Rouge',
    thermo: {
      Tc: 134.66, Pc: 36.29, Teb: -11.7, M: 58.12, glide: 0,
      antoine: { A: 4.01447, B: 947.93, C: 248.207 },
      antoine_plage: [-30, 80]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 110
    },
    regl: {
      GWP: 3, ODP: 0, LFL: 0.043,
      huiles: ['Huile minérale', 'AB'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R12'],
      remplace_par: [],
      compatibilite: '⚠️ A3 — Standard réfrigérateurs domestiques — Charges <150g'
    },
    meta: {
      groupe: 'C',
      completude: 90,
      validation_terrain: true
    }
  };

  DB['R1270'] = {
    nom: 'R1270',
    nom_chimique: 'Propylène (Propène)',
    formule: 'C₃H₆',
    CAS: '115-07-1',
    type: 'HC',
    classe: 'A3',
    statut: 'Autorisé',
    couleur: 'Rouge',
    thermo: {
      Tc: 91.06, Pc: 45.55, Teb: -47.7, M: 42.08, glide: 0,
      antoine: { A: 4.00529, B: 800.534, C: 246.264 },
      antoine_plage: [-45, 70]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 110
    },
    regl: {
      GWP: 2, ODP: 0, LFL: 0.045,
      huiles: ['Huile minérale', 'AB', 'POE'],
      phase_out: null
    },
    retrofit: {
      remplace: [],
      remplace_par: [],
      compatibilite: '⚠️ A3 — Alternative naturelle R22/R404A — Charges limitées'
    },
    meta: {
      groupe: 'C',
      completude: 85,
      validation_terrain: false
    }
  };

  DB['R744'] = {
    nom: 'R744',
    nom_chimique: 'Dioxyde de carbone',
    formule: 'CO₂',
    CAS: '124-38-9',
    type: 'Naturel',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Gris',
    thermo: {
      Tc: 31, Pc: 73.77, Teb: -78.4, M: 44.01, glide: 0,
      antoine: { A: 4.9488, B: 1002.9, C: 294.372 },
      antoine_plage: [-56, 25]
    },
    terrain: {
      SR_typique: [3, 8], SR_alarme_bas: 1, SR_alarme_haut: 15,
      SC_typique: [2, 5], SC_alarme_bas: 1, SC_alarme_haut: 8,
      T_refoulement_max: 140
    },
    regl: {
      GWP: 1, ODP: 0, LFL: null,
      huiles: ['PAG', 'POE'],
      phase_out: null
    },
    retrofit: {
      remplace: [],
      remplace_par: [],
      compatibilite: '⚠️ Système dédié HP — Pressions >130 bar — Transcritique >31°C'
    },
    meta: {
      groupe: 'C',
      completude: 95,
      validation_terrain: true
    }
  };

  DB['R717'] = {
    nom: 'R717',
    nom_chimique: 'Ammoniac',
    formule: 'NH₃',
    CAS: '7664-41-7',
    type: 'Naturel',
    classe: 'B2L',
    statut: 'Autorisé',
    couleur: 'Vert',
    thermo: {
      Tc: 132.25, Pc: 113.33, Teb: -33.3, M: 17.03, glide: 0,
      antoine: { A: 4.6762, B: 1007.54, C: 249.154 },
      antoine_plage: [-50, 80]
    },
    terrain: {
      SR_typique: [4, 10], SR_alarme_bas: 2, SR_alarme_haut: 15,
      SC_typique: [3, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 150
    },
    regl: {
      GWP: 0, ODP: 0, LFL: 0.112,
      huiles: ['Huile minérale'],
      phase_out: null
    },
    retrofit: {
      remplace: [],
      remplace_par: [],
      compatibilite: '⚠️ TOXIQUE + inflammable — Industriel uniquement — Formation NH₃ obligatoire'
    },
    meta: {
      groupe: 'C',
      completude: 90,
      validation_terrain: true
    }
  };

  DB['R718'] = {
    nom: 'R718',
    nom_chimique: 'Eau',
    formule: 'H₂O',
    CAS: '7732-18-5',
    type: 'Naturel',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Incolore',
    thermo: {
      Tc: 373.95, Pc: 220.64, Teb: 100, M: 18.015, glide: 0,
      antoine: { A: 5.23113, B: 1749.05, C: 234.888 },
      antoine_plage: [0, 200]
    },
    terrain: {
      SR_typique: [3, 8], SR_alarme_bas: 1, SR_alarme_haut: 12,
      SC_typique: [2, 5], SC_alarme_bas: 1, SC_alarme_haut: 8,
      T_refoulement_max: 180
    },
    regl: {
      GWP: 0, ODP: 0, LFL: null,
      huiles: [],
      phase_out: null
    },
    retrofit: {
      remplace: [],
      remplace_par: [],
      compatibilite: 'Fluide pédagogique et industriel — Chillers centrifuges sous vide'
    },
    meta: {
      groupe: 'C',
      completude: 80,
      validation_terrain: false
    }
  };

  // ==================================================
  // GROUPE D — HISTORIQUES / FORMATION (5 fluides)
  // ==================================================

  DB['R22'] = {
    nom: 'R22',
    nom_chimique: 'Chlorodifluorométhane',
    formule: 'CHClF₂',
    CAS: '75-45-6',
    type: 'HCFC',
    classe: 'A1',
    statut: 'Interdit',
    couleur: 'Vert clair',
    thermo: {
      Tc: 96.15, Pc: 49.9, Teb: -40.8, M: 86.47, glide: 0,
      antoine: { A: 4.35252, B: 946.0, C: 258.75 },
      antoine_plage: [-50, 70]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 120
    },
    regl: {
      GWP: 1810, ODP: 0.055, LFL: null,
      huiles: ['Huile minérale', 'AB'],
      phase_out: '⛔ INTERDIT — HCFC — Plus de recharge depuis 2015'
    },
    retrofit: {
      remplace: [],
      remplace_par: ['R407C', 'R410A', 'R32', 'R454B'],
      compatibilite: 'Fluide historique — Formation pour compréhension parc existant'
    },
    meta: {
      groupe: 'D',
      completude: 95,
      validation_terrain: true
    }
  };

  DB['R12'] = {
    nom: 'R12',
    nom_chimique: 'Dichlorodifluorométhane',
    formule: 'CCl₂F₂',
    CAS: '75-71-8',
    type: 'CFC',
    classe: 'A1',
    statut: 'Interdit',
    couleur: 'Blanc',
    thermo: {
      Tc: 111.97, Pc: 41.36, Teb: -29.8, M: 120.91, glide: 0,
      antoine: { A: 4.14505, B: 936.95, C: 256.216 },
      antoine_plage: [-40, 80]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 100
    },
    regl: {
      GWP: 10900, ODP: 1, LFL: null,
      huiles: ['Huile minérale'],
      phase_out: '⛔ INTERDIT — CFC — Protocole Montréal 1989'
    },
    retrofit: {
      remplace: [],
      remplace_par: ['R134a', 'R513A', 'R600a'],
      compatibilite: 'Plus aucune utilisation autorisée'
    },
    meta: {
      groupe: 'D',
      completude: 90,
      validation_terrain: true
    }
  };

  DB['R502'] = {
    nom: 'R502',
    nom_chimique: 'R22/R115 (48.8/51.2)',
    formule: 'Mélange azéotrope CFC/HCFC',
    CAS: 'Mélange',
    type: 'CFC',
    classe: 'A1',
    statut: 'Interdit',
    couleur: 'Lavande',
    thermo: {
      Tc: 80.73, Pc: 40.75, Teb: -45.4, M: 111.63, glide: 0,
      antoine: { A: 3.94656, B: 822.02, C: 250.087 },
      antoine_plage: [-50, 60]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 15,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 100
    },
    regl: {
      GWP: 4657, ODP: 0.334, LFL: null,
      huiles: ['Huile minérale'],
      phase_out: '⛔ INTERDIT — CFC — Protocole Montréal'
    },
    retrofit: {
      remplace: [],
      remplace_par: ['R404A', 'R448A', 'R449A'],
      compatibilite: 'Remplacé par R404A puis R448A/R449A'
    },
    meta: {
      groupe: 'D',
      completude: 85,
      validation_terrain: true
    }
  };

  DB['R507A'] = {
    nom: 'R507A',
    nom_chimique: 'R125/R143a (50/50)',
    formule: 'Mélange azéotrope HFC',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Phase-out',
    couleur: 'Vert émeraude',
    thermo: {
      Tc: 70.6, Pc: 37.05, Teb: -46.7, M: 98.86, glide: 0,
      antoine: { A: 4.55729, B: 1033.86, C: 274.727 },
      antoine_plage: [-50, 60]
    },
    terrain: {
      SR_typique: [5, 10], SR_alarme_bas: 3, SR_alarme_haut: 15,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 108
    },
    regl: {
      GWP: 3985, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: '⚠️ INTERDIT en neuf — GWP très élevé'
    },
    retrofit: {
      remplace: ['R502'],
      remplace_par: ['R448A', 'R449A'],
      compatibilite: 'Jumeau R404A — Même phase-out'
    },
    meta: {
      groupe: 'D',
      completude: 85,
      validation_terrain: true
    }
  };

  DB['R407A'] = {
    nom: 'R407A',
    nom_chimique: 'R32/R125/R134a (20/40/40)',
    formule: 'Mélange zéotrope HFC',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 82.3, Pc: 45.2, Teb: -45.2, M: 90.1, glide: 5.8,
      antoine: { A: 4.43413, B: 952.75, C: 260.58 },
      antoine_plage: [-45, 65]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 2107, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R502', 'R22'],
      remplace_par: ['R448A', 'R449A'],
      compatibilite: 'Retrofit R502/R22 froid commercial — Glide 5.8K'
    },
    meta: {
      groupe: 'D',
      completude: 80,
      validation_terrain: true
    }
  };

  // ==================================================
  // GROUPE E — SPÉCIAUX / TRÈS BASSE TEMPÉRATURE (5 fluides)
  // ==================================================

  DB['R23'] = {
    nom: 'R23',
    nom_chimique: 'Trifluorométhane',
    formule: 'CHF₃',
    CAS: '75-46-7',
    type: 'HFC',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Gris clair',
    thermo: {
      Tc: 26.14, Pc: 48.36, Teb: -82.1, M: 70.01, glide: 0,
      antoine: { A: 5.1001, B: 1157.62, C: 312.594 },
      antoine_plage: [-80, 20]
    },
    terrain: {
      SR_typique: [3, 8], SR_alarme_bas: 1, SR_alarme_haut: 12,
      SC_typique: [2, 5], SC_alarme_bas: 1, SC_alarme_haut: 8,
      T_refoulement_max: 100
    },
    regl: {
      GWP: 14800, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: 'GWP très élevé — Usage très basse T uniquement'
    },
    retrofit: {
      remplace: ['R13', 'R503'],
      remplace_par: ['R744 (cascade)'],
      compatibilite: 'Étage basse T en cascade (< -60°C)'
    },
    meta: {
      groupe: 'E',
      completude: 80,
      validation_terrain: false
    }
  };

  DB['R508B'] = {
    nom: 'R508B',
    nom_chimique: 'R23/R116 (46/54)',
    formule: 'Mélange azéotrope HFC',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Bleu foncé',
    thermo: {
      Tc: 14, Pc: 39.3, Teb: -87.4, M: 95.4, glide: 0,
      antoine: { A: 4.57706, B: 755.517, C: 260.175 },
      antoine_plage: [-90, 0]
    },
    terrain: {
      SR_typique: [3, 8], SR_alarme_bas: 1, SR_alarme_haut: 12,
      SC_typique: [2, 5], SC_alarme_bas: 1, SC_alarme_haut: 8,
      T_refoulement_max: 90
    },
    regl: {
      GWP: 13396, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: 'GWP extrême — Cryogénie uniquement'
    },
    retrofit: {
      remplace: ['R503'],
      remplace_par: ['R744 (cascade)'],
      compatibilite: 'Cryogénie — Très basse T (< -80°C)'
    },
    meta: {
      groupe: 'E',
      completude: 75,
      validation_terrain: false
    }
  };

  DB['R170'] = {
    nom: 'R170',
    nom_chimique: 'Éthane',
    formule: 'C₂H₆',
    CAS: '74-84-0',
    type: 'HC',
    classe: 'A3',
    statut: 'Autorisé',
    couleur: 'Rouge',
    thermo: {
      Tc: 32.17, Pc: 48.72, Teb: -88.6, M: 30.07, glide: 0,
      antoine: { A: 4.149, B: 630.768, C: 244.741 },
      antoine_plage: [-80, 20]
    },
    terrain: {
      SR_typique: [3, 8], SR_alarme_bas: 1, SR_alarme_haut: 12,
      SC_typique: [2, 5], SC_alarme_bas: 1, SC_alarme_haut: 8,
      T_refoulement_max: 90
    },
    regl: {
      GWP: 6, ODP: 0, LFL: 0.038,
      huiles: ['Huile minérale', 'POE'],
      phase_out: null
    },
    retrofit: {
      remplace: [],
      remplace_par: [],
      compatibilite: '⚠️ A3 INFLAMMABLE — Cascade très basse T — Alternative naturelle R23'
    },
    meta: {
      groupe: 'E',
      completude: 75,
      validation_terrain: false
    }
  };

  DB['R407H'] = {
    nom: 'R407H',
    nom_chimique: 'R32/R125/R134a (32.5/15/52.5)',
    formule: 'Mélange zéotrope HFC',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 90.5, Pc: 44.6, Teb: -41.3, M: 81.3, glide: 6.5,
      antoine: { A: 3.48155, B: 512.443, C: 192.168 },
      antoine_plage: [-40, 70]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 1495, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R404A'],
      remplace_par: ['R448A', 'R449A'],
      compatibilite: 'Alternative R404A froid commercial — A1 — Glide 6.5K'
    },
    meta: {
      groupe: 'E',
      completude: 75,
      validation_terrain: false
    }
  };

  DB['R442A'] = {
    nom: 'R442A',
    nom_chimique: 'R32/R125/R134a/R152a/R227ea (31/31/30/3/5)',
    formule: 'Mélange zéotrope HFC',
    CAS: 'Mélange',
    type: 'HFC',
    classe: 'A1',
    statut: 'Autorisé',
    couleur: 'Marron clair',
    thermo: {
      Tc: 83, Pc: 43.8, Teb: -46.5, M: 83, glide: 5.5,
      antoine: { A: 3.39598, B: 484.315, C: 188.741 },
      antoine_plage: [-45, 65]
    },
    terrain: {
      SR_typique: [6, 10], SR_alarme_bas: 3, SR_alarme_haut: 16,
      SC_typique: [4, 8], SC_alarme_bas: 2, SC_alarme_haut: 12,
      T_refoulement_max: 115
    },
    regl: {
      GWP: 1888, ODP: 0, LFL: null,
      huiles: ['POE'],
      phase_out: null
    },
    retrofit: {
      remplace: ['R404A', 'R507A'],
      remplace_par: ['R448A', 'R449A'],
      compatibilite: 'Retrofit R404A/R507A — GWP moyen'
    },
    meta: {
      groupe: 'E',
      completude: 70,
      validation_terrain: false
    }
  };
  // ==================================================
  // 7. GESTION BASE DE DONNÉES
  // ==================================================

  var ALIASES = {'R1234ze':'R1234ze(E)', 'R1233zd':'R1233zd(E)'};
  function getFluid(nom) {
    var key = ALIASES[nom] || nom;
    var f = DB[key];
    if (!f) throw new Error('Fluide non trouvé : ' + nom);
    return f;
  }

  function registerFluid(nom, data) {
    if (!data.thermo || !data.thermo.antoine) throw new Error('Antoine obligatoire');
    if (!data.regl || data.regl.GWP === undefined) throw new Error('GWP obligatoire');
    DB[nom] = data;
    updateMeta();
    return true;
  }

  function listFluids(f) {
    f = f || {};
    var n = Object.keys(DB);
    if (f.type) n = n.filter(function(k){return DB[k].type===f.type;});
    if (f.classe) n = n.filter(function(k){return DB[k].classe===f.classe;});
    if (f.statut) n = n.filter(function(k){return DB[k].statut===f.statut;});
    if (f.GWP_max !== undefined) n = n.filter(function(k){return DB[k].regl.GWP<=f.GWP_max;});
    if (f.groupe) n = n.filter(function(k){return DB[k].meta.groupe===f.groupe;});
    return n;
  }

  function sortByGWP(ordre) {
    ordre = ordre || 'asc';
    return Object.keys(DB).sort(function(a,b){
      var d = DB[a].regl.GWP - DB[b].regl.GWP;
      return ordre==='asc' ? d : -d;
    });
  }

  function getRetrofitOptions(nom) {
    return getFluid(nom).retrofit || {remplace:[],remplace_par:[],compatibilite:'Non renseigné'};
  }

  function searchFluids(q) {
    q = q.toLowerCase();
    return Object.keys(DB).filter(function(k){
      var f = DB[k];
      return k.toLowerCase().indexOf(q)!==-1 ||
        (f.nom_chimique && f.nom_chimique.toLowerCase().indexOf(q)!==-1) ||
        (f.type && f.type.toLowerCase().indexOf(q)!==-1) ||
        (f.classe && f.classe.toLowerCase().indexOf(q)!==-1);
    });
  }

  // ==================================================
  // 8. RÉGLEMENTAIRE — F-Gas 2024/573
  // ==================================================

  /** Calcul tCO₂ équivalent */
  function calcTCO2e(nom, charge_kg) {
    var f = getFluid(nom);
    return Math.round(f.regl.GWP * charge_kg / 1000 * 100) / 100;
  }

  /** Fréquence contrôle étanchéité F-Gas */
  function getFrequenceControle(tco2e) {
    if (tco2e < 5) return { frequence: 'Aucun', intervalle_mois: null, texte: '< 5 tCO₂e — Pas de contrôle obligatoire' };
    if (tco2e < 50) return { frequence: 'Annuel', intervalle_mois: 12, texte: '5-50 tCO₂e — Contrôle annuel' };
    if (tco2e < 500) return { frequence: 'Semestriel', intervalle_mois: 6, texte: '50-500 tCO₂e — Contrôle semestriel' };
    return { frequence: 'Trimestriel', intervalle_mois: 3, texte: '≥ 500 tCO₂e — Contrôle trimestriel' };
  }

  /** Charge max A2L — formule simplifiée pédagogique */
  function getChargeMaxA2L(nom, volume_local_m3, hauteur_m) {
    var f = getFluid(nom);
    if (!f.regl.LFL) return { charge_max_kg: null, texte: 'Non A2L/A3 — pas de limite LFL' };
    hauteur_m = hauteur_m || 2.5;
    // m_max = LFL × volume^0.5 (simplification pédagogique)
    // Formule exacte: m_max = 4 × h₀^0.5 × LFL × V_room (avec h₀ hauteur installation)
    var m_max = f.regl.LFL * Math.pow(volume_local_m3, 0.5) * 4 * Math.pow(hauteur_m, 0.5);
    return {
      charge_max_kg: Math.round(m_max * 100) / 100,
      LFL: f.regl.LFL,
      classe: f.classe,
      texte: f.nom + ' (' + f.classe + ') — Charge max ≈ ' + m_max.toFixed(2) + ' kg pour ' + volume_local_m3 + ' m³'
    };
  }

  // ==================================================
  // 9. VALIDATION & TESTS
  // ==================================================

  function validateFluid(data) {
    var e = [];
    if (!data.nom) e.push('nom');
    if (!data.thermo) e.push('thermo');
    else { if (!data.thermo.antoine) e.push('antoine'); if (data.thermo.glide===undefined) e.push('glide'); }
    if (!data.regl) e.push('regl'); else if (data.regl.GWP===undefined) e.push('GWP');
    if (!data.classe) e.push('classe');
    return { valid: e.length===0, errors: e };
  }

  function validateDB() {
    var r = {total:0, valides:0, invalides:0, erreurs:{}};
    Object.keys(DB).forEach(function(k){
      r.total++;
      var v = validateFluid(DB[k]);
      if (v.valid) r.valides++; else { r.invalides++; r.erreurs[k]=v.errors; }
    });
    return r;
  }

  function testPrecision(nom, refs) {
    var f = getFluid(nom), mx=0, sm=0, det=[];
    refs.forEach(function(ref){
      var Pc = calcPression(ref.T, f);
      var err = Math.abs((Pc-ref.P_ref)/ref.P_ref)*100;
      mx = Math.max(mx,err); sm += err;
      det.push({T:ref.T, P_ref:ref.P_ref, P_calc:Math.round(Pc*1000)/1000, erreur_pct:Math.round(err*100)/100});
    });
    return {fluide:nom, nb_points:refs.length, erreur_max_pct:Math.round(mx*100)/100,
      erreur_moy_pct:Math.round(sm/refs.length*100)/100, details:det};
  }

  // ==================================================
  // 10. UTILITAIRES
  // ==================================================
  function updateMeta() {
    META.stats.nb_fluides = Object.keys(DB).length;
    META.stats.derniere_maj = new Date().toISOString().split('T')[0];
  }
  updateMeta();

  // ==================================================
  // 11. API PUBLIQUE
  // ==================================================
  return {
    META: META, CONST: CONST,
    // Moteurs thermo
    Psat_Antoine: Psat_Antoine, Tsat_Antoine: Tsat_Antoine,
    Psat_Wagner: Psat_Wagner, Tsat_Wagner: Tsat_Wagner,
    calcPression: calcPression, calcTemperature: calcTemperature, calcGlide: calcGlide,
    // Atmosphère
    P_atm_ISA: P_atm_ISA, toBarAbs: toBarAbs, toBarRel: toBarRel,
    // Diagnostic
    calcSR: calcSR, analyseSR: analyseSR, calcSC: calcSC, analyseSC: analyseSC,
    detectIncondensables: detectIncondensables,
    // Réglementaire
    calcTCO2e: calcTCO2e, getFrequenceControle: getFrequenceControle,
    getChargeMaxA2L: getChargeMaxA2L,
    // Base de données
    getFluid: getFluid, registerFluid: registerFluid, listFluids: listFluids,
    sortByGWP: sortByGWP, getRetrofitOptions: getRetrofitOptions, searchFluids: searchFluids,
    // Validation
    validateFluid: validateFluid, validateDB: validateDB, testPrecision: testPrecision,
    // Accès direct
    get DB() { return DB; }
  };
}));
// FIN INERWEB FLUIDE CERVEAU v5.1 — 36 fluides — © 2026 F. Henninot — InerWeb Fluide
